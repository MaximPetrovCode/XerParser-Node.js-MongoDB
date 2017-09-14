const express = require('express');
const hbs = require('express-handlebars');
const fs = require('fs-extra');
const path = require('path');
const mongodb = require('mongodb');
const lineReader = require('line-by-line');
const bodyParser = require('body-parser');

//set port
const port = 3000;

//init app
const app = express();

//create MongoDB client
const client = mongodb.MongoClient;
const urlMongoDB = 'mongodb://localhost:27017/db';

app.use(express.static(path.join(__dirname, '/source')));

//body-parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

//set handlebars
app.set('view engine', 'handlebars');
app.engine('handlebars', hbs({ defaultLayout: 'index' }));

app.post('/show', function(req, res){
    let table = req.body.table;
    if (!table) 
        table = "TASK"; //set default task
    console.log(table);
    client.connect(urlMongoDB, function(err, db){
        if (err) throw err;
        db.collection(table).findOne({}, function(err, result){ //return first element of TASK
            if (err) throw err;
            db.close();
            //console.log(result);
            res.render('details',{data: JSON.stringify(result), table: table});
        });
    });    
});


app.get('/', function (req, res) {
    clearMongoDB(urlMongoDB,parseXer(urlMongoDB));
    res.render('main');
});

/*
function printTable(urlMongoDB){
    client.connect(urlMongoDB, function(err, db){
        if (err) throw err;
        db.collection("TASK").findOne({}, function(err, result){ //return first element of TASK
            if (err) throw err;
            db.close();
            console.log(result);
            return JSON.stringify(result);
        });
    });
}
*/

app.listen(port, function () {
    console.log('app is listening on ' + port + ' port');
});

function clearMongoDB(urlMongoDB,callback) {
    client.connect(urlMongoDB, function (err, db) {
        if (err) return;
        db.dropDatabase(()=> console.log('DB is empty'));
    });

    callback;
}

function parseXer(urlMongoDB, callback) {
    //get file direciry
    const filePath = __dirname + '/source/data.xer';

    //Reading file line by line
    const readline = new lineReader(filePath);


    readline.on('error', (err) => {
        if (err) return console.log(err.message);
    });

    client.connect(urlMongoDB, (err, db) => {
        if (err) {
            console.log('Unsuccessful connection to Data Base! Run MongoDB (command: sudo service mongodb start)');
            return;
        }
        
        
        console.log('Connected to MongoDB');

        //Initialization of variables
        let tableName;
        let obj = {};
        let currentLine;
        let fields = lineRecords = [];

        readline.on('line', (fileLine) => {

            //Split lines to array
            let lines = fileLine.split('\r\n');
            //console.log(lines);

            for (let line of lines) {

                //Split lines to array elements
                currentLine = line.split('\t');

                if (currentLine[0] === '%T') {

                    tableName = currentLine[1];

                    //Create collection with table name
                    db.createCollection(tableName, (err, result) => {
                        if (err) return console.log(err.message);
                        console.log(tableName, ' is created');
                        readline.resume();
                    });

                    readline.pause();
                } else if (currentLine[0] === '%F') {

                    //Add to array head names
                    fields = currentLine.slice(1);

                } else if (currentLine[0] === '%R') {

                    //Add to array lines
                    lineRecords = currentLine.slice(1);

                    // Clean Object
                    obj = {};

                    for (let j = 0; j < fields.length; j++) {
                        obj[fields[j]] = lineRecords[j];
                    };

                    //Insert data to collection
                    db.collection(tableName).insertOne(obj, (err, result) => {
                        if (err) return console.log(err.message);
                        //console.log(tableName, '\n', obj);
                        readline.resume();
                    });

                    readline.pause();
                    
                };
            };
        });


        readline.on('end', () => {
            console.log('Done!');
            db.close();
        });
    });

    callback;
}