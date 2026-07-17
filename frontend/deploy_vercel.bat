@echo off
echo ==================================================
echo STEP 6 - INSTALL VERCEL CLI
echo ==================================================
call npm install -g vercel

echo.
echo ==================================================
echo STEP 7 - DEPLOY
echo ==================================================
echo If you are not logged in, Vercel will pause here to authenticate you.
call vercel --prod

echo.
echo ==================================================
echo STEP 8 - VERIFY
echo ==================================================
echo Deployment process finished. Please check the Vercel URLs provided above!
pause
