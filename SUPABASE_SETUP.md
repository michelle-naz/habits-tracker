# Supabase Setup Guide for Habit Tracker

This guide will help you set up Supabase authentication and database for your habit tracker application.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/sign in
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - Name: `habit-tracker` (or your preferred name)
   - Database Password: Choose a strong password
   - Region: Select closest to your location
5. Click "Create new project"
6. Wait for the project to be ready (2-3 minutes)

## 2. Get Your Project Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **https://ghsqzmmsoxxzoanvunkq.supabase.co** (starts with `https://`)
   - **Project API Keys** → **eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdoc3F6bW1zb3h4em9hbnZ1bmtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzMjY3MTQsImV4cCI6MjA2NTkwMjcxNH0.SfBitsVR769DhXQCZqKlBtrdfsoikChIFSlWvfwRRmQ** key

## 3. Set Environment Variables

Create a `.env.local` file in your project root and add:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ghsqzmmsoxxzoanvunkq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdoc3F6bW1zb3h4em9hbnZ1bmtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzMjY3MTQsImV4cCI6MjA2NTkwMjcxNH0.SfBitsVR769DhXQCZqKlBtrdfsoikChIFSlWvfwRRmQ
```

Replace the values with your actual Supabase project URL and anon key.

## 4. Create Database Tables

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy and paste the following SQL to create the required tables:

```sql
-- Create habits table
CREATE TABLE habits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create habit_entries table  
CREATE TABLE habit_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  habit_id UUID REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  completed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(habit_id, user_id, date)
);

-- Enable Row Level Security (RLS)
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_entries ENABLE ROW LEVEL SECURITY;

-- Create policies for habits table
CREATE POLICY "Users can view their own habits" ON habits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own habits" ON habits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own habits" ON habits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own habits" ON habits
  FOR DELETE USING (auth.uid() = user_id);

-- Create policies for habit_entries table  
CREATE POLICY "Users can view their own habit entries" ON habit_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own habit entries" ON habit_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own habit entries" ON habit_entries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own habit entries" ON habit_entries
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_habits_user_id ON habits(user_id);
CREATE INDEX idx_habit_entries_user_id ON habit_entries(user_id);
CREATE INDEX idx_habit_entries_habit_id ON habit_entries(habit_id);
CREATE INDEX idx_habit_entries_date ON habit_entries(date);
```

4. Click "Run" to execute the SQL

## 5. Configure Authentication

1. In your Supabase dashboard, go to **Authentication** → **Settings**
2. Under **General settings**:
   - Set **Site URL** to `http://localhost:3001` (or your deployment URL)
   - Enable **Enable email confirmations** if you want email verification
3. Under **Auth Providers**:
   - **Email** should be enabled by default
   - **Google**: If you want Google OAuth:
     - Toggle "Enable Google provider"
     - Add your Google OAuth credentials (Client ID and Secret)
     - Set Authorized redirect URIs to include your domain

## 6. Test Your Setup

1. Make sure your environment variables are set in `.env.local`
2. Restart your development server: `npm run dev`
3. Open `http://localhost:3001` (or your configured port)
4. You should see the authentication page
5. Try signing up with a new account
6. Check that you can create habits and track them

## 7. Database Verification

You can verify your setup by:

1. Going to **Database** → **Tables** in Supabase
2. You should see `habits` and `habit_entries` tables
3. After creating habits in your app, check that data appears in these tables

## 8. Optional: Google OAuth Setup

If you want to enable Google sign-in:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `https://your-project-ref.supabase.co/auth/v1/callback`
6. Copy Client ID and Secret to Supabase Auth settings

## Troubleshooting

### Common Issues:

1. **Environment variables not loading**: Make sure `.env.local` is in the root directory and restart your dev server
2. **Authentication errors**: Check that your Supabase URL and anon key are correct
3. **Database errors**: Verify that RLS policies are set up correctly
4. **CORS errors**: Make sure your Site URL is configured in Supabase Auth settings

### Error Messages:

- `Invalid API key`: Check your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `Network error`: Check your `NEXT_PUBLIC_SUPABASE_URL`
- `Row Level Security`: Make sure RLS policies are created for your tables

## Security Notes

- The anon key is safe to use in client-side code
- Row Level Security (RLS) ee! 🎉 nsures users can only access their own data
- Never expose your service role key in client-side code
- Always use environment variables for sensitive configuration

## Deployment

When deploying to production:

1. Update your `.env.local` or deployment environment variables
2. Update the Site URL in Supabase Auth settings to your production domain
3. If using Google OAuth, add your production domain to authorized redirect URIs

Your habit tracker is now ready with user authentication and cloud data storag