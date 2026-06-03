@echo off
echo Syncing game files to www...
xcopy /E /Y /I js\ www\js\
xcopy /E /Y /I css\ www\css\
xcopy /E /Y /I plants\ www\plants\
xcopy /E /Y /I assets\ www\assets\
copy /Y index.html www\index.html
copy /Y manifest.json www\manifest.json
copy /Y sw.js www\sw.js
echo Done! Now run: npx cap sync
pause