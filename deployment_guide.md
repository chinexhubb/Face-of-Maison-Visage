# Glow Deployment Guide (Render)

Because we have bundled the frontend `public` files securely inside of the `glow-backend` NodeJS server, you can now deploy your entire application to a free hosting provider like **Render** with a single GitHub repository.

## Step 1: Push to GitHub
1. Open up your terminal inside of the `glow-backend` folder.
2. Run the following commands to initialize Git and push your code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of full-stack Glow app"
   ```
3. Create a new repository on GitHub.
4. Link it to your local folder and push:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

## Step 2: Deploy on Render
1. Go to [Render.com](https://render.com/) and create a free account.
2. Click **New +** and select **Web Service**.
3. Connect your GitHub account and select your new Glow repository.
4. Configure the following settings:
   - **Name**: glow-app (or whatever you prefer)
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. **CRITICAL**: Scroll down to the **Environment Variables** section and add the required API Keys exactly as they appear in your `.env` file:
   - `MONGODB_URI` = `mongodb+srv://nemeworkmail_db_user:pFRVtYSYV02m37Ns@chinexhub.dcvk4ix.mongodb.net/glow?appName=chinexhub`
   - `PAYSTACK_SECRET_KEY` = `sk_test_replace_with_your_key`
   - `RESEND_API_KEY` = `re_3GYAtz1a_HjKi3AHAmybpyk15sPJJQcDe`
6. Click **Create Web Service**.

Render will now download your code, install `mongoose`, `resend`, and `express`, and boot up your server. Once it is finished, Render will provide you with a live URL (e.g., `https://glow-app.onrender.com`). 

Because we updated the `script.js` to use relative routing (`/api`), the frontend will automatically make API requests directly to the live Render domain!
