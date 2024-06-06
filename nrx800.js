
module.exports = function(RED) {
    "use strict";
    var Pigpio = require('js-pigpio');

    const defaultHost = "::1";
    const defaultPort = 8888;

    function revertDigitalInput(l){
        const level = Number(l)
        if (level === 0){
            return 1
        } else {
            return 0
        }
    }

    function objectFlip(obj) {
        const ret = {};
        Object.keys(obj).forEach(key => {
          ret[obj[key]] = key;
        });
        return ret;
      }

    const relayNumberPinMapping = {
        "1": "4",
        "2": "5",
        "3": "6",
        "4": "12",
        "5": "13",
        "6": "16",
        "7": "17",
        "8": "18"
    }

    const digitalInputNumberPinMapping = {
        "1": "20",
        "2": "21",
        "3": "22",
        "4": "23",
        "5": "24",
        "6": "25",
        "7": "26",
        "8": "27"
    }

    const digitalInputPinMapping = objectFlip(digitalInputNumberPinMapping)

    const relayStatusMapping = {
        0: "OPEN",
        1: "CLOSED"
    }

    function Relay(n) {
        RED.nodes.createNode(this,n);
        this.host = n.host || defaultHost;
        this.port = n.port || defaultPort;
        this.relay = n.number;
        this.pio = relayNumberPinMapping[n.number];
        this.set = n.set || false;
        this.level = parseInt(n.level || 0);
        this.out = n.out || "out";
        this.freq = parseInt(n.freq) || 800;
        var node = this;
        var PiGPIO;

        function inputlistener(msg) {
            // node.log('Received message '+msg.payload+" for relay "+node.relay);
            if (msg.payload === "true") { msg.payload = true; }
            if (msg.payload === "false") { msg.payload = false; }
            var out = Number(msg.payload);

            // if (msg.relay !== undefined){
            //     var relayNumber = parseInt(msg.relay)
            //     if (0 < relayNumber < 9){
            //         node.debug("Received message for relay "+ relayNumber)
            //         node.relay = msg.relay
            //         node.pio = relayMapping[msg.relay]
            //     } else {
            //         node.warn("Received invalid relay number "+relayNumber);
            //         return
            //     }
            // }

            if (out === 0 || out === 1){
                node.debug('Set relay '+ node.relay + " to "+out);
                if (RED.settings.verbose) { node.log("out: "+msg.payload); }
                PiGPIO.write(node.pio, out);
                node.status({fill:"grey",shape:"ring",text:relayStatusMapping[out]});
                node.send({ topic:"nrx800/relay/"+node.relay, relay:parseInt(node.relay), payload:relayStatusMapping[out], host:node.host });
            }
            else { node.warn(RED._("pi-gpiod:errors.invalidinput")+": "+out); }
        }

        if (node.pio !== undefined) {
            PiGPIO = new Pigpio();
            var inerror = false;
            var run = function() {
                PiGPIO.pi(node.host, node.port, function(err) {
                    if (err) {
                        node.status({fill:"red",shape:"ring",text:err.code+" "+node.host+":"+node.port});
                        if (!inerror) { node.error(err,err); inerror = true; }
                        node.retry = setTimeout(function() { run(); }, 5000);
                    }
                    else {
                        inerror = false;
                        PiGPIO.set_mode(node.pio,PiGPIO.OUTPUT);
                        if (node.set) {

                            setTimeout(function() { PiGPIO.write(node.pio,node.level); }, 25 );
                            node.status({fill:"green",shape:"dot",text:node.level});
                        } else {
                            node.status({fill:"green",shape:"dot",text:"node-red:common.status.ok"});
                        }
                    }
                });
            }
            run();
            node.on("input", inputlistener);
        }
        else {
            node.warn(RED._("pi-gpiod:errors.invalidpin")+": "+node.pio);
        }

        node.on("close", function(done) {
            if (node.retry) { clearTimeout(node.retry); }
            node.status({fill:"grey",shape:"ring",text:"pi-gpiod.status.closed"});
            PiGPIO.close();
            done();
        });
    }
    RED.nodes.registerType("nrx800 relay",Relay);

    function DigitalInput(n) {
        RED.nodes.createNode(this,n);
        this.host = n.host || defaultHost;
        this.port = n.port || defaultPort;
        this.input = n.number;
        this.pio = digitalInputNumberPinMapping[n.number];
        this.intype = "PUD_OFF";
        this.read = n.read || true;
        this.debounce = Number(n.debounce || 25);
        var node = this;
        var PiGPIO;

        if (node.pio !== undefined) {
            PiGPIO = new Pigpio();
            var inerror = false;
            var run = function() {
                PiGPIO.pi(node.host, node.port, function(err) {
                    if (err) {
                        node.status({fill:"red",shape:"ring",text:err.code+" "+node.host+":"+node.port});
                        if (!inerror) { node.error(err); inerror = true; }
                        node.retry = setTimeout(function() { run(); }, 5000);
                    }
                    else {
                        inerror = false;
                        PiGPIO.set_mode(node.pio,PiGPIO.INPUT);
                        PiGPIO.set_glitch_filter(node.pio,node.debounce);
                        node.status({fill:"green",shape:"dot",text:"node-red:common.status.ok"});
                        node.cb = PiGPIO.callback(node.pio, PiGPIO.EITHER_EDGE, function(gpio, level, tick) {
                            node.debug('Received status '+level+" for input "+node.input+" on gpio "+gpio);
                            node.send({ topic:"nrx800/input/"+node.input, input:parseInt(node.input), payload:revertDigitalInput(level), host:node.host });
                            node.status({fill:"grey",shape:"dot",text:revertDigitalInput(level)});
                        });
                        if (node.read) {
                            setTimeout(function() {
                                PiGPIO.read(node.pio, function(err, level) {
                                    node.send({ topic:"nrx800/input/"+node.input, input:parseInt(node.input), payload:revertDigitalInput(level), host:node.host });
                                    node.status({fill:"grey",shape:"dot",text:revertDigitalInput(level)});
                                });
                            }, 20);
                        }
                    }
                });
            }
            run();
        }
        else {
            node.warn(RED._("pi-gpiod:errors.invalidpin")+": "+node.pio);
        }

        node.on("close", function(done) {
            if (node.retry) { clearTimeout(node.retry); }
            node.status({fill:"grey",shape:"ring",text:"pi-gpiod.status.closed"});
            node.cb.cancel();
            PiGPIO.close();
            done();
        });
    }
    RED.nodes.registerType("nrx800 input",DigitalInput);

    function DigitalInputs(n) {
        RED.nodes.createNode(this,n);
        this.host = n.host || defaultHost;
        this.port = n.port || defaultPort;
        this.intype = "PUD_OFF";
        this.read = n.read || true;
        this.debounce = Number(n.debounce || 25);
        var node = this;
        var PiGPIO;

        PiGPIO = new Pigpio();
        var inerror = false;
        var run = function() {
            PiGPIO.pi(node.host, node.port, function(err) {
                if (err) {
                    node.status({fill:"red",shape:"ring",text:err.code+" "+node.host+":"+node.port});
                    if (!inerror) { node.error(err); inerror = true; }
                    node.retry = setTimeout(function() { run(); }, 5000);
                }
                else {
                    inerror = false;
                    node.cb = [];
                    for (let input in digitalInputNumberPinMapping){
                        const pio = digitalInputNumberPinMapping[input]
                        node.debug("Iterate over input "+input+" on pin "+pio)
                        PiGPIO.set_mode(pio, PiGPIO.INPUT);
                        PiGPIO.set_glitch_filter(pio,node.debounce);
                        var cb = PiGPIO.callback(pio, PiGPIO.EITHER_EDGE, function(gpio, level, tick) {
                            var input = digitalInputPinMapping[gpio]
                            node.debug('Received status '+level+" for input "+input+" on gpio "+gpio);
                            node.send({ topic:"nrx800/input/"+input, input:parseInt(input), payload:revertDigitalInput(level), host:node.host });
                        });
                        node.cb.push(cb)
                        // if (node.read) {
                        //     setTimeout(function() {
                        //         PiGPIO.read(pio, function(err, level) {
                        //             node.send({ topic:"input/"+input, payload:revertDigitalInput(level), host:node.host });
                        //         });
                        //     }, 20);
                        // }
                    }
                    node.status({fill:"green",shape:"dot",text:"node-red:common.status.ok"});
                }
            });
        }
        run();

        node.on("close", function(done) {
            if (node.retry) { clearTimeout(node.retry); }
            node.status({fill:"grey",shape:"ring",text:"pi-gpiod.status.closed"});
            node.cb.forEach((element) => element.cancel());
            PiGPIO.close();
            done();
        });
    }
    RED.nodes.registerType("nrx800 inputs",DigitalInputs);

}


