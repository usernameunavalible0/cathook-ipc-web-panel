LOG=logs/main.log

echo "Open http://localhost:8081 in your browser, don't forget to enter password from $LOG!"
echo "Logging to $LOG"
sudo DISPLAY=$DISPLAY $(which node || which nodejs) app | sudo tee $LOG >/dev/null
