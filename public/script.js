const API_BASE = '/api'; // Changed to relative path for seamless server-side routing

document.addEventListener("DOMContentLoaded", () => {
    
    // --- REGISTRATION LOGIC ---
    const regForm = document.getElementById("registrationForm");
    if(regForm) {
        regForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            const name = document.getElementById("fullName").value;
            const email = document.getElementById("email").value;
            const bio = document.getElementById("bio").value;
            
            try {
                const res = await fetch(`${API_BASE}/contestants`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, bio })
                });
                const data = await res.json();
                
                if(data.success) {
                    const generatedLink = window.location.origin + `/contestant.html?id=${data.id}`;
                    regForm.style.display = "none";
                    document.getElementById("successMessage").classList.remove("hidden");
                    document.getElementById("votingLink").value = generatedLink;
                } else {
                    alert("Registration failed: " + data.error);
                }
            } catch (err) {
                console.error(err);
                alert("Error connecting to server.");
            }
        });

        document.getElementById("copyLinkBtn").addEventListener("click", () => {
            const linkInput = document.getElementById("votingLink");
            linkInput.select();
            document.execCommand("copy");
            alert("Voting link copied to clipboard!");
        });
    }

    // --- CONTESTANTS GRID LOGIC ---
    const grid = document.getElementById("contestantsGrid");
    if(grid) {
        let allContestants = [];
        
        const renderGrid = (data) => {
            grid.innerHTML = "";
            data.forEach(c => {
                const card = document.createElement("div");
                card.className = "contestant-card";
                card.innerHTML = `
                    <img src="${c.img}" alt="${c.name}" class="contestant-img">
                    <div class="contestant-info">
                        <h3>${c.name}</h3>
                        <div class="votes-count">${c.votes.toLocaleString()} Votes</div>
                        <a href="contestant.html?id=${c.id}" class="btn-secondary full-width">Vote Now (₦100/vote)</a>
                    </div>
                `;
                grid.appendChild(card);
            });
        }
        
        // Fetch contestants from API
        fetch(`${API_BASE}/contestants`)
            .then(res => res.json())
            .then(data => {
                allContestants = data;
                renderGrid(allContestants);
            })
            .catch(err => console.error(err));

        // Search Logic
        const searchInput = document.getElementById("searchContestant");
        if(searchInput) {
            searchInput.addEventListener("input", (e) => {
                const val = e.target.value.toLowerCase();
                const filtered = allContestants.filter(c => c.name.toLowerCase().includes(val));
                renderGrid(filtered);
            });
        }
    }

    // --- INDIVIDUAL CONTESTANT / PAYMENT LOGIC ---
    if(document.getElementById("profileName")) {
        const urlParams = new URLSearchParams(window.location.search);
        let contestantId = urlParams.get('id');
        
        if (!contestantId) {
            // Default ID for testing if none provided
            contestantId = 1;
        }

        fetch(`${API_BASE}/contestants/${contestantId}`)
            .then(res => res.json())
            .then(contestant => {
                if(contestant.error) {
                    alert("Contestant not found");
                    return;
                }
                document.getElementById("profileImage").src = contestant.img;
                document.getElementById("profileName").innerText = contestant.name;
                document.getElementById("voteForName").innerText = contestant.name;
                document.getElementById("profileVotes").innerText = contestant.votes.toLocaleString();
                document.getElementById("profileBio").innerText = contestant.bio;
            })
            .catch(err => console.error(err));

        // Payment Tabs
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                // remove active class from all
                tabs.forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                
                // add to current
                tab.classList.add('active');
                document.getElementById(tab.dataset.tab + 'Tab').classList.remove('hidden');
            });
        });

        // Vote Calculation
        const voteInput = document.getElementById("voteCount");
        const pricePerVote = 100; // ₦100 per vote
        
        voteInput.addEventListener('input', (e) => {
            const votes = parseInt(e.target.value) || 0;
            const total = (votes * pricePerVote);
            document.getElementById("calcTotal").innerText = total.toLocaleString(undefined, {minimumFractionDigits: 2});
            document.getElementById("transferAmount").innerText = total.toLocaleString(undefined, {minimumFractionDigits: 2});
        });

        // Handle Voting (Paystack initialization and verification)
        const processPaystackVote = () => {
            const votes = parseInt(voteInput.value) || 0;
            if (votes <= 0) {
                alert("Please enter a valid number of votes.");
                return;
            }

            const voterEmail = document.getElementById("voterEmail")?.value;
            if (!voterEmail) {
                alert("Please enter your email for the receipt.");
                return;
            }

            const voterNameInput = document.getElementById("voterName")?.value || "Anonymous User";
            const totalCostNaira = votes * 100; // ₦100 per vote
            const costInKobo = totalCostNaira * 100; // Paystack takes amount in kobo

            // Make sure the PaystackInline script is loaded
            if (typeof PaystackPop === 'undefined') {
                alert("Paystack library not loaded. Please check your internet connection.");
                return;
            }

            const paystackOptions = {
                key: 'pk_test_replace_this_with_your_public_key', // Replace with your actual public key
                email: voterEmail,
                amount: costInKobo,
                currency: 'NGN', 
                ref: 'FACE_MAISON_' + Math.floor((Math.random() * 1000000000) + 1), // Generate a random reference
                callback: function(response) {
                    // Payment successful on frontend, now verify on backend. Send total cost to record revenue.
                    verifyPaymentAndVote(response.reference, totalCostNaira, "Paystack", voterNameInput);
                },
                onClose: function() {
                    alert('Transaction was not completed, window closed.');
                }
            };

            const handler = PaystackPop.setup(paystackOptions);
            handler.openIframe();
        };

        const verifyPaymentAndVote = async (reference, amount, method, voterName) => {
            try {
                const res = await fetch(`${API_BASE}/vote/verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reference: reference,
                        contestantId: contestantId,
                        amount: amount,
                        method: method,
                        status: 'Success',
                        voterName: voterName
                    })
                });
                const data = await res.json();
                
                if (data.success) {
                    alert("Payment Verified! Vote submitted successfully!");
                    window.location.reload();
                } else {
                    alert("Failed to verify transaction: " + data.error);
                }
            } catch (err) {
                console.error(err);
                alert("Error connecting to server for verification.");
            }
        };

        const paystackBtn = document.getElementById("paystackBtn");
        if(paystackBtn) {
            paystackBtn.addEventListener("click", (e) => {
                e.preventDefault();
                processPaystackVote();
            });
        }
        
        const transferPayBtn = document.getElementById("transferPayBtn");
        if(transferPayBtn) {
            transferPayBtn.addEventListener("click", (e) => {
                e.preventDefault();
                // Transfer mock isn't using Paystack
                alert('Waiting for transfer confirmation via API (e.g. Paystack webhook)');
            });
        }
    }

    // --- ADMIN DASHBOARD LOGIC ---
    if(document.getElementById("totalRevenue")) {
        
        fetch(`${API_BASE}/admin/stats`)
            .then(res => res.json())
            .then(stats => {
                document.getElementById("totalSiteVotes").innerText = (stats.totalVotes || 0).toLocaleString();
                document.getElementById("totalRevenue").innerText = "₦" + (stats.totalRevenue || 0).toLocaleString(undefined, {minimumFractionDigits: 2});
                document.getElementById("totalContestants").innerText = stats.totalContestants || 0;

                const tbody = document.getElementById("transactionsTable");
                tbody.innerHTML = "";
                (stats.recentTransactions || []).forEach(t => {
                    const tr = document.createElement("tr");
                    const badgeClass = t.status === 'Success' ? 'badge-success' : 'badge-pending';
                    tr.innerHTML = `
                        <td>${t.voter_name || 'Anonymous'}</td>
                        <td>${t.cName}</td>
                        <td>₦${(t.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td>${t.method}</td>
                        <td><span class="badge ${badgeClass}">${t.status}</span></td>
                    `;
                    tbody.appendChild(tr);
                });

                const topList = document.getElementById("adminTopContestants");
                topList.innerHTML = "";
                (stats.topContestants || []).forEach((c, index) => {
                    const div = document.createElement("div");
                    div.className = "top-contestant-item";
                    div.innerHTML = `
                        <div style="font-weight: 700; color: var(--text-muted); width: 20px;">#${index+1}</div>
                        <img src="${c.img}" class="tc-img" alt="${c.name}">
                        <div class="tc-info flex-grow" style="flex-grow: 1;">
                            <div class="tc-name">${c.name}</div>
                            <div class="tc-votes">${c.votes.toLocaleString()} Votes</div>
                        </div>
                        <div style="font-weight: 600; color: var(--success-color);">₦${(c.votes * 100).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    `;
                    topList.appendChild(div);
                });
            })
            .catch(err => console.error(err));
    }
});
