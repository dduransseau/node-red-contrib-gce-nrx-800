const { Default, Edge } = require('opengpio');

module.exports = function(RED) {
	
    const relayNumberPinMapping = {
        "1": 4,
        "2": 5,
        "3": 6,
        "4": 12,
        "5": 13,
        "6": 16,
        "7": 17,
        "8": 18
    }

    const digitalInputNumberPinMapping = {
        "1": 20,
        "2": 21,
        "3": 22,
        "4": 23,
        "5": 24,
        "6": 25,
        "7": 26,
        "8": 27
    }
	
	const digitalInputStatusMapping = {
        0: "RISING",
        1: "FALLING"
    }

    const relayStatusMapping = {
        0: "OPEN",
        1: "CLOSED"
    }

    const ledStatusMapping = {
        0: "ON",
        1: "OFF"
    }
	
	function revertDigitalInput(l){
        const level = Number(l)
        if (level === 0){
            return 1
        } else {
            return 0
        }
    }
	
  function DigitalInputNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
	this.inputNumber = parseInt(config.number);
	this.pin = digitalInputNumberPinMapping[config.number];
	let input;
	let lastEventTime = performance.now();
    let lastValue = null;
    
    try {
		node.watcher = Default.watch({ chip: 0, line: node.pin }, Edge.Both);
		node.watcher.on('change', (value) => {
			input = value ? 0 : 1;
			// Debounce
			const now = performance.now();
			// console.log(now, now - lastEventTime, config.debounce, value, input);
			if (now - lastEventTime < config.debounce){
				return
			}
			lastEventTime = now;
			
			node.send({
			  status: digitalInputStatusMapping[input],
			  pin: node.pin,
			  input: node.inputNumber,
			  payload: input
			});
			// Mettre à jour le statut visuel
			node.status({
			  fill: input ? 'green' : 'grey',
			  shape: 'dot'
			});
		});
		// Initial read
		input = node.watcher.value ? false : true;
		node.status({
		  fill: input ? 'green' : 'grey',
		  shape: 'dot'
		}); 
    } catch(err) {
      node.error('GPIO init error: ' + err.message);
      node.status({fill: 'red', shape: 'ring', text: 'Error'});
    }
    
    node.on('close', function(done) {
		node.watcher.stop();
		if (node.watcher) {
		node.watcher.unexport()
		  .then(() => done())
		  .catch(err => {
			node.error('Cleanup error: ' + err.message);
			done();
		  });
		} else {
			done();
		}
    });
  }
  RED.nodes.registerType("nrx800-digital-input", DigitalInputNode);
  
  function RelayNode(n) {
		RED.nodes.createNode(this,n);
        this.relayNumber = parseInt(n.number);
        this.pin = relayNumberPinMapping[n.number];
		var node = this;
		
		node.gpioReady = false;
		node.pendingValue = null;
		
		function inputlistener(msg) {
			var out = Number(msg.payload);
			if (out === 0 || out === 1){
				if (node.pin){
					node.relay.value = out;
					node.send({ relay:node.relayNumber, status:relayStatusMapping[out], pin: node.pin, payload: out});
					node.status({fill:"grey",shape:"dot",text:relayStatusMapping[out]});
				}
				// Confirm that node is configured to listen on multiple relay to avoid chaotic behavior
				// else if (msg.relay !== undefined && node.relayNumber === "msg"){
					// var relayNumber = parseInt(msg.relay)
					// if (0 < relayNumber < 9){
						// node.debug("Received message for relay "+ relayNumber)
						// node.relay = Default.output({ chip: 0, line: relayNumber });
						// setImmediate(() => {
							// node.ready = true;
							// if (node.pendingValue !== null) {
							  // try {
								// node.relay.value = node.pendingValue;
								// node.updateStatus(node.pendingValue);
								// node.pendingValue = null;
							  // } catch(err) {
								// node.error('Failed to set pending value: ' + err.message);
							  // }
							// }
						  // });
					// } else {
						// node.warn("Received invalid relay number "+relayNumber);
						// return
					// }
				// }
				// console.log('Set relay '+ node.relayNumber + " to "+out+" on pin "+node.pin, node.id);
				if (RED.settings.verbose) { node.log("out: "+msg.payload); }
			}
			else { node.warn("Invalid value: "+out+" (Supported value are 0,1,true,false)") }
		}
		// console.log("Setup relay ", node.relayNumber, "for GPIO", node.pin);
		if (this.pin !== undefined) {
			node.relay = Default.output({ chip: 0, line: node.pin });
		} else if (node.number == "msg") {
			console.log("Setup relay defined at message level");
		} else {
            this.warn(RED._("pi-gpiod:errors.invalidpin")+": "+this.pio);
        }
		this.on("input", inputlistener);
		this.on('close', (done) => {
		  node.relay.stop();
		  done();
		});
	}
    RED.nodes.registerType("nrx800-relay",RelayNode);
  
  
    function LedUser(n) {
        RED.nodes.createNode(this,n);
        this.pio = 19;
        var node = this;

        function inputlistener(msg) {
            // node.log('Received message '+msg.payload+" for relay "+node.relay);
            if (msg.payload === "true")
				msg.payload = 1; 
            else if (msg.payload === "false")
				msg.payload = 0; 
            else if (msg.payload === "ON")
				msg.payload = 1;
            else if (msg.payload === "OFF")
				msg.payload = 0;
            var out = Number(msg.payload);
            if (out === 0 || out === 1){
                out = revertDigitalInput(out);
				node.led.value = out;
                node.debug("Set user led to "+ledStatusMapping[out]);
                node.status({fill:out ? 'grey' : 'green', shape:"dot", text:ledStatusMapping[out]});
                node.send({ status:ledStatusMapping[out], payload: out});
            }
            else { node.warn("Invalid value: "+out+" (Supported value are 0,1,true,false,ON,OFF)") }
        }

        node.led = Default.output({ chip: 0, line: node.pio });
		node.led.value = true;
        node.on("input", inputlistener);

        node.on("close", function(done) {
            node.led.stop();
            done();
        });
    }
    RED.nodes.registerType("nrx800-led-user", LedUser);
};