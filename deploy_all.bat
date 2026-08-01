@echo off
setlocal

echo ==============================================
echo FloodSense AI - Build, Git Push, and Vercel Deploy
echo ==============================================

echo [1/4] Checking and Building Frontend to ensure no errors...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed! Please fix the errors before pushing.
    cd ..
    exit /b %errorlevel%
)
echo Frontend build succeeded!
cd ..

echo.
echo [2/4] Staging and Committing to Git...
git add .
git commit -m "fix: AI Prediction Engine, Knowledge Graph, and UI stability fixes"
if %errorlevel% neq 0 (
    echo [WARN] Git commit had an issue or there are no changes to commit.
)

echo.
echo [3/4] Pushing to Git Repository...
git push
if %errorlevel% neq 0 (
    echo [ERROR] Git push failed!
    exit /b %errorlevel%
)
echo Git push successful!

echo.
echo [4/4] Deploying to Vercel...
cd frontend
call vercel --prod
if %errorlevel% neq 0 (
    echo [ERROR] Vercel deployment failed!
    cd ..
    exit /b %errorlevel%
)
cd ..
echo.
echo ==============================================
echo SUCCESS: Everything pushed and deployed without errors!
echo ==============================================
pause
