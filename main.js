// import { setTimeout } from 'timers';

const electron = require('electron')
// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow

const path = require('path')
const url = require('url')

const server = require('./server')
var ws;

var WebSocketClient = require('websocket').client;
const WebSocket = require('ws')

const homePageUrl = "http://localhost:8008"

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 800, height: 600})
  mainWindow.setMenu(null)
  // and load the index.html of the app.
  mainWindow.loadURL(homePageUrl)

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })



}
const setupWS = () => { 
  ws  = new WebSocket("ws://localhost:8008/stage");

  ws.onmessage = function (e) {
      var cmd = JSON.parse(e.data);

      if(cmd.cmd == "show") {

          var url = cmd.url;
          mainWindow.loadURL(url);
        // window.location = url;
      } else if(cmd.cmd == "idle") {
          // $('#idle_container').fadeIn('slow');
      } else if(cmd.cmd == "close") {
        mainWindow.loadURL(homePageUrl)
      }
  };
}

setTimeout(setupWS,5000)

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
