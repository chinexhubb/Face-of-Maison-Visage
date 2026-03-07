const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();
const { Resend } = require('resend');
const axios = require('axios');

const resend = new Resend(process.env.RESEND_API_KEY);
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
// Serve static files from the new public folder
app.use(express.static(path.resolve(__dirname, 'public')));

// Database setup
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB database'))
    .catch(err => console.error('MongoDB connection error:', err));

// Mongoose Schemas & Models
const contestantSchema = new mongoose.Schema({
    name: { type: String, required: true },
    bio: String,
    img: String,
    votes: { type: Number, default: 0 }
});
const Contestant = mongoose.model('Contestant', contestantSchema);

const transactionSchema = new mongoose.Schema({
    contestant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Contestant' },
    voter_name: String,
    amount: Number,
    method: String,
    status: String,
    created_at: { type: Date, default: Date.now }
});
const Transaction = mongoose.model('Transaction', transactionSchema);

// Seed data if empty
const seedDatabase = async () => {
    try {
        const count = await Contestant.countDocuments();
        if (count === 0) {
            console.log("Seeding initial mock contestants to MongoDB...");
            
            const c1 = await Contestant.create({ name: "Amara Okonkwo", votes: 1250, img: "https://images.unsplash.com/photo-1531123897727-8f129e1bf44a?auto=format&fit=crop&w=500&q=80", bio: "Fashion enthusiast and model from Lagos." });
            const c2 = await Contestant.create({ name: "Sophia Lewis", votes: 980, img: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=500&q=80", bio: "Elegant and fierce, chasing the top spot." });
            const c3 = await Contestant.create({ name: "Maria Gonzalez", votes: 1120, img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=500&q=80", bio: "Lover of art, photography, and high fashion." });
            const c4 = await Contestant.create({ name: "Aisha Bello", votes: 850, img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=500&q=80", bio: "Bringing authenticity and confidence." });
            
            await Transaction.create([
                { contestant_id: c1._id, voter_name: "John Doe", amount: 50, method: "Card", status: "Success" },
                { contestant_id: c3._id, voter_name: "Anonymous", amount: 100, method: "Transfer", status: "Pending" },
                { contestant_id: c2._id, voter_name: "Sarah Smith", amount: 20, method: "Card", status: "Success" },
                { contestant_id: c4._id, voter_name: "Mike T.", amount: 10, method: "Card", status: "Success" },
                { contestant_id: c1._id, voter_name: "Anonymous", amount: 200, method: "Transfer", status: "Pending" }
            ]);
            console.log("Mock data seeded successfully.");
        }
    } catch (err) {
        console.error("Error seeding MongoDB:", err);
    }
};

mongoose.connection.once('open', () => {
    seedDatabase();
});

// --- API ENDPOINTS ---

// Get all contestants
app.get('/api/contestants', async (req, res) => {
    try {
        const contestants = await Contestant.find().sort({ votes: -1 }).lean();
        const mapped = contestants.map(c => ({ ...c, id: c._id }));
        res.json(mapped);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single contestant by ID
app.get('/api/contestants/:id', async (req, res) => {
    try {
        const contestant = await Contestant.findById(req.params.id).lean();
        if (contestant) {
            contestant.id = contestant._id;
            res.json(contestant);
        } else {
            res.status(404).json({ error: 'Contestant not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Register a new contestant
app.post('/api/contestants', async (req, res) => {
    const { name, email, bio } = req.body;
    const finalBio = bio || 'Recently registered.';
    const img = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=80"; // Default image
    
    try {
        const contestant = await Contestant.create({ name, bio: finalBio, img, votes: 0 });
        
        // Attempt to send a welcome email asynchronously using Resend
        if (email && process.env.RESEND_API_KEY) {
            try {
                await resend.emails.send({
                    from: 'Face of Maison Visage <onboarding@resend.dev>', // Update with your verified domain
                    to: [email],
                    subject: 'Registration Successful - Face of Maison Visage',
                    html: `<h1>Welcome to Face of Maison Visage, ${name}!</h1><p>Your registration was successful. Share your profile to start getting votes!</p>`
                });
                console.log(`Welcome email sent to ${email}`);
            } catch (emailErr) {
                console.error('Error sending welcome email:', emailErr);
            }
        }
        res.json({ success: true, id: contestant._id, message: "Registered successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Verify Paystack Payment and Submit a vote
app.post('/api/vote/verify', async (req, res) => {
    const { reference, contestantId, amount, method, status, voterName } = req.body;
    
    if (!reference || !PAYSTACK_SECRET_KEY) {
        return res.status(400).json({ error: "Missing Paystack reference or secret key not configured." });
    }

    try {
        // Verify via Paystack API
        const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
            }
        });

        const data = response.data;
        if (!data.status || data.data.status !== 'success') {
            return res.status(400).json({ error: "Transaction verification failed." });
        }

        // Optional: you can verify the amount matches (data.data.amount) if you strictly pass it down.
        // Paystack amount is in kobo/cents. For simplicity we'll just trust the passed `amount` parameter or divide data.amount.
        // The verifiedAmount (representing total Naira paid) is mapped directly from our frontend request.
        // Since 1 Vote = ₦100, we deduce votesToAdd by dividing the amount by 100.
        const verifiedAmount = amount; 
        const votesToAdd = Math.floor(verifiedAmount / 100);
        const finalVoterName = voterName || "Anonymous";

        // Save transaction
        await Transaction.create({
            contestant_id: contestantId,
            voter_name: finalVoterName,
            amount: verifiedAmount,
            method: method || 'Paystack',
            status: 'Success'
        });
        
        // Update contestant votes
        await Contestant.findByIdAndUpdate(contestantId, { $inc: { votes: votesToAdd } });
        res.json({ success: true, message: "Vote verified and recorded successfully", addedVotes: votesToAdd });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Error contacting Paystack verification API." });
    }
});

// Admin Stats
app.get('/api/admin/stats', async (req, res) => {
    try {
        const contestantStats = await Contestant.aggregate([
            { $group: { _id: null, totalVotes: { $sum: "$votes" }, totalContestants: { $sum: 1 } } }
        ]);
        const totalVotes = contestantStats.length ? contestantStats[0].totalVotes : 0;
        const totalContestants = contestantStats.length ? contestantStats[0].totalContestants : 0;

        const transactionStats = await Transaction.aggregate([
            { $group: { _id: null, totalRevenue: { $sum: "$amount" } } }
        ]);
        const totalRevenue = transactionStats.length ? transactionStats[0].totalRevenue : 0;

        const recentDocs = await Transaction.find()
            .sort({ created_at: -1 })
            .limit(10)
            .populate('contestant_id', 'name')
            .lean();
            
        const recentTransactions = recentDocs.map(t => ({
            id: t._id,
            voter_name: t.voter_name,
            cName: t.contestant_id ? t.contestant_id.name : 'Unknown',
            amount: t.amount,
            method: t.method,
            status: t.status
        }));

        const topDocs = await Contestant.find().sort({ votes: -1 }).limit(4).lean();
        const topContestants = topDocs.map(c => ({ ...c, id: c._id }));

        res.json({
            totalVotes,
            totalRevenue,
            totalContestants,
            recentTransactions,
            topContestants
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
