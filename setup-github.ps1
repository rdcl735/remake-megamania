# Megalomania Remake - GitHub Setup Script
# Run this script to connect your local repository to GitHub

$remoteUrl = "https://github.com/rdcl735/remake-megamania.git"

Write-Host "Connecting to remote repository: $remoteUrl" -ForegroundColor Cyan

# Add remote
git remote add origin $remoteUrl

# Rename branch to main (standard)
git branch -M main

Write-Host "Success! You can now push your code using:" -ForegroundColor Green
Write-Host "git push -u origin main" -ForegroundColor Yellow
