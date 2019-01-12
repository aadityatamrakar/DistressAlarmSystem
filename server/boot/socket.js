'use strict';
module.exports = function(server) {
  var app = require('express')();
  var http = require('http').Server(app);
  var io = require('socket.io')(http);
  var ss = require('socket.io-stream');
  var groups = {
    controller: [],
  };
  var dataflow = {};

  app.get('/', function(req, res) {
    res.send('running');
  });

  io.on('disconnection', function(socket) {
    console.log('disconnected');
  });

  io.on('connection', function(socket) {
    console.log('connected: ' + socket.id);
    socket.on('message', function(evt, stream) {
      // console.log(Object.keys(io.sockets.connected));
      let type = clientType(socket.id);
      console.log(type);
      if (type != 'controller') {
        console.log('emitting to controller');
        socket.broadcast.to('controller').emit('controller', socket.id);
      }
    });

    socket.on('signal', function(client, todo) {
      let type = clientType(socket.id);
      if (type == 'controller') {
        dataflow[client] = todo;
        if (todo)
          socket.broadcast.to(client).emit('message', 'startVideoStream');
        else {
          socket.broadcast.to(client).emit('message', 'stopVideoStream');
          setTimeout(_ => {
            socket.broadcast.to(type).emit('stream', 'https://via.placeholder.com/150/');
          }, 100);
          socket.broadcast.to('controller').emit('stream', 'https://via.placeholder.com/150/');
        }
      }
      console.log(dataflow);
    });
    socket.on('stream', function(stream) {
      let type = clientType(socket.id);

      if (type != 'controller' &&
        typeof dataflow[socket.id] == 'boolean' &&
        dataflow[socket.id]) {
        socket.broadcast.to(type).emit('stream', stream);
        socket.broadcast.to('controller').emit('stream', stream);
      }

      if (type == 'controller') {
        let sendTo = Object.keys(dataflow).map(elm => {
          if (dataflow[elm])
            socket.broadcast.to(elm).emit('stream', stream);
        });
        // socket.broadcast.to(type).emit('stream', stream);
        // socket.broadcast.to('controller').emit('stream', stream);
      }
    });

    socket.on('register', function(evt) {
      if (evt == 'controller') {
        socket.join('controller');
        groups.controller.push(socket.client.id);
        socket.emit('message', 'Registered as controller');
      } else {
        if (typeof groups[evt] == 'undefined') groups[evt] = [];
        groups[evt].push(socket.client.id);
        socket.join(evt);
        socket.emit('message', 'Registered in ' + evt);
      }
      console.log(groups);
    });

    socket.on('disconnect', (disconnect) => {
      let type = clientType(socket.id);
      groups[type].splice(groups[type].indexOf(socket.id), 1);
      console.log('disconnected: ' + socket.id);
    });
  });

  http.listen(3001, function() {
    console.log('listening on *:3001');
  });

  function clientType(clientId) {
    return Object.keys(groups).reduce((type, key) => (
        (groups[key].indexOf(clientId) != -1) ? key : type),
        ''
      );
  }
};
