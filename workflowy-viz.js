var express = require('express');
var config  = require('./config');
var path    = require('path');
var fs      = require('fs');

var app = express();
app.use(express.static('public'));

function readLatestBackupFile() {
    var fileName = '(marcin.ignac@gmail.com).2016-1-28.workflowy.backup';
    var filePath = path.join(config.WORKFLOWY_BACKUP_DIR, fileName);

    return fs.readFileSync(filePath, 'utf8');
}

app.get('/data', function (req, res) {
  res.send(readLatestBackupFile());
});

app.listen(3001, function () {
  console.log('Example app listening on port 3001!');
});
