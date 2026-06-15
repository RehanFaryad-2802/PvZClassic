@echo off
echo ==============================
echo  Building PvZ Classic App
echo ==============================

echo.
echo 1. Cleaning www...
rmdir /S /Q www
mkdir www

echo.
echo 2. Copying source files...

xcopy /E /Y js www\js\
xcopy /E /Y css www\css\
xcopy /E /Y plants www\plants\
xcopy /E /Y assets www\assets\

copy /Y index.html www\index.html
copy /Y manifest.json www\manifest.json
copy /Y sw.js www\sw.js

echo.
echo 3. Syncing Capacitor...
npx cap sync android

echo.
echo 4. Copying Android assets...
npx cap copy android

echo.
echo ==============================
echo  BUILD COMPLETE
echo ==============================

echo.
echo Launching Android...
npx cap run android

pause