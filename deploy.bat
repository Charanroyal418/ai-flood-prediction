@echo off
echo Committing codebase for Vercel and Render deployment...
git add .
git commit -m "chore: Prepare for Vercel and Render production deployment"
echo.
echo =========================================
echo ✅ Commit successful!
echo.
echo NEXT STEPS:
echo 1. Create a GitHub repository.
echo 2. Run: git remote add origin ^<your-github-url^>
echo 3. Run: git push -u origin main
echo.
echo Then, head to Render to deploy the backend and Vercel to deploy the frontend.
echo =========================================
