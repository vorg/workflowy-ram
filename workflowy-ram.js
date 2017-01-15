var express = require('express')
var config = require('./config')
var path = require('path')
var fs = require('fs')
var hoquet = require('hoquet')

var app = express()
app.use(express.static('public'))

function readdirChronological (dir) {
  return fs.readdirSync(dir)
    .map(function (name) {
      return { name: name,
        time: fs.statSync(path.join(dir, name)).mtime.getTime()
      }
    })
    .sort(function (a, b) { return a.time - b.time })
    .map(function (file) { return file.name })
}


function readLatestBackupFile () {
  var fileName = readdirChronological(config.WORKFLOWY_BACKUP_DIR).reverse()[0]
  var filePath = path.join(config.WORKFLOWY_BACKUP_DIR, fileName)

  return fs.readFileSync(filePath, 'utf8')
}



app.get('/data', function (req, res) {
  const data = readLatestBackupFile()
  console.log(data)
  res.send(data)
})

app.listen(3005, function () {
  console.log('Example app listening on port 3001!')
})
