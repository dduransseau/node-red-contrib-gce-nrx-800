
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

    const ledStatusMapping = {
        0: "ON",
        1: "OFF"
    }

    function Relay(n) {
        RED.nodes.createNode(this,n);
        this.host = n.host || defaultHost;
        this.port = n.port || defaultPort;
        this.relay = n.number;
        this.pio = relayNumberPinMapping[n.number];
        var node = this;
        var PiGPIO;

        function inputlistener(msg) {
            // node.log('Received message '+msg.payload+" for relay "+node.relay);
            if (msg.payload === "true") { msg.payload = 1; }
            if (msg.payload === "false") { msg.payload = 0; }
            if (msg.payload === "ON") { msg.payload = 1; }
            if (msg.payload === "OFF") { msg.payload = 0; }
            var out = Number(msg.payload);
            if (out === 0 || out === 1){
                var pio = node.pio;
                var relay = node.relay;

                // Confirm that node is configured to listen on multiple relay to avoid chaotic behavior
                if (msg.relay !== undefined && node.relay === "msg"){
                    var relayNumber = parseInt(msg.relay)
                    if (0 < relayNumber < 9){
                        node.debug("Received message for relay "+ relayNumber)
                        relay = msg.relay
                        pio = relayNumberPinMapping[msg.relay]
                    } else {
                        node.warn("Received invalid relay number "+relayNumber);
                        return
                    }
                }
                node.debug('Set relay '+ relay + " to "+out+" on pin "+pio);

                PiGPIO.set_mode(pio, instance.INPUT);
                PiGPIO.read(pio, function(result) {
                    node.debug('Read relay '+ relay + " as value "+result);
                })
                PiGPIO.set_mode(pio,PiGPIO.OUTPUT);

                if (RED.settings.verbose) { node.log("out: "+msg.payload); }
                PiGPIO.write(pio, out);
                node.send({ topic:"nrx800/relay/"+relay, relay:parseInt(relay), payload:relayStatusMapping[out], host:node.host });
                if (node.pio !== undefined) {
                    node.status({fill:"grey",shape:"ring",text:relayStatusMapping[out]});
                }
            }
            else { node.warn("Invalid value: "+out+" (Supported value are 0,1,true,false)") }
        }

        if (node.relay !== undefined) {
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
                        if (node.relay === "msg") {
                            // Set all relay pin as output since selection will be set on msg
                            for (let relayNumber in relayNumberPinMapping){
                                PiGPIO.set_mode(relayNumberPinMapping[relayNumber], PiGPIO.OUTPUT);
                            }
                        } else {
                            node.debug("Setup relay "+ node.relay+" on pin "+node.pio)
                            PiGPIO.set_mode(node.pio,PiGPIO.OUTPUT);
                        }
                        node.status({fill:"green",shape:"dot",text:"node-red:common.status.ok"});
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
        node.callbacks = [];
        var PiGPIO;

        function setupDigitalInputGpio(instance, pin){
            instance.set_mode(pin,instance.INPUT);
            instance.set_glitch_filter(pin, node.debounce);
            node.callbacks.push(PiGPIO.callback(pin, instance.EITHER_EDGE, function (gpio, level, tick) {
                var input = digitalInputPinMapping[gpio]
                node.debug('Received status '+level+" for input "+input+" on gpio "+gpio);
                node.send({ topic:"nrx800/input/"+input, input:parseInt(input), payload:revertDigitalInput(level), host:node.host });
                if (node.pio !== undefined) {
                    node.status({fill:"grey",shape:"dot",text:revertDigitalInput(level)});
                }
            }))
        }

        if (node.input !== undefined) {
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
                        // Set specific digital input
                        if (node.pio !== undefined) {
                            setupDigitalInputGpio(PiGPIO, node.pio)
                            // Read status of input on deploy
                            if (node.read) {
                                setTimeout(function() {
                                    PiGPIO.read(node.pio, function(err, level) {
                                        node.send({ topic:"nrx800/input/"+node.input, input:parseInt(node.input), payload:revertDigitalInput(level), host:node.host });
                                        node.status({fill:"grey",shape:"dot",text:revertDigitalInput(level)});
                                    });
                                }, 20);
                            }
                        } // Set all digital input
                        else {
                            for (let input in digitalInputNumberPinMapping){
                                const pio = digitalInputNumberPinMapping[input]
                                node.debug("Iterate over input "+input+" on pin "+pio)
                                setupDigitalInputGpio(PiGPIO, pio)
                            }
                        }
                        node.status({fill:"green",shape:"dot",text:"node-red:common.status.ok"});
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
            node.callbacks.forEach((element) => element.cancel());
            PiGPIO.close();
            done();
        });
    }
    RED.nodes.registerType("nrx800 input",DigitalInput);

    function LedUser(n) {
        RED.nodes.createNode(this,n);
        this.host = n.host || defaultHost;
        this.port = n.port || defaultPort;
        this.pio = 19;
        var node = this;
        var PiGPIO;

        function inputlistener(msg) {
            // node.log('Received message '+msg.payload+" for relay "+node.relay);
            if (msg.payload === "true") { msg.payload = 1; }
            if (msg.payload === "false") { msg.payload = 0; }
            if (msg.payload === "ON") { msg.payload = 1; }
            if (msg.payload === "OFF") { msg.payload = 0; }
            var out = Number(msg.payload);
            if (out === 0 || out === 1){
                out = revertDigitalInput(out);
                node.debug("Set user led to "+ledStatusMapping[out]);
                if (RED.settings.verbose) { node.log("out: "+msg.payload); }
                PiGPIO.write(node.pio, out);
                node.status({fill:"grey",shape:"ring",text:ledStatusMapping[out]});
                node.send({ topic:"nrx800/led/user", payload:ledStatusMapping[out], host:node.host });
            }
            else { node.warn("Invalid value: "+out+" (Supported value are 0,1,true,false,ON,OFF)") }
        }

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
                    node.debug("Setup user led")
                    PiGPIO.set_mode(node.pio, PiGPIO.OUTPUT);
                    node.status({fill:"green",shape:"dot",text:"node-red:common.status.ok"});
                }
            });
        }
        run();
        node.on("input", inputlistener);

        node.on("close", function(done) {
            if (node.retry) { clearTimeout(node.retry); }
            node.status({fill:"grey",shape:"ring",text:"pi-gpiod.status.closed"});
            PiGPIO.close();
            done();
        });
    }
    RED.nodes.registerType("nrx800 led-user", LedUser);
}
