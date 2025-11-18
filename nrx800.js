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
        true: "rising",
        false: "falling"
    }

    const relayStatusMapping = {
        true: "closed",
		false: "open"
    }

    const ledStatusMapping = {
        true: "on",
        false: "off"
    }
	
	function revertDigitalInput(l){
		return l ? false : true
    }
	
    function DigitalInputNode(config) {
		RED.nodes.createNode(this, config);
		const node = this;
		node.inputNumber = parseInt(config.number);
		node.pin = digitalInputNumberPinMapping[config.number];
		node.config = config;
		let input;
		let lastEventTime = performance.now();
		let lastValue = null;
		
		try {
			node.watcher = Default.watch({ chip: 0, line: node.pin }, Edge.Both);
			node.watcher.on('change', (value) => {
				input = value ? false : true;
				// Debounce
				const now = performance.now();
				// node.log(now, now - lastEventTime, config.debounce, value, input);
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
				  fill: input ? node.config.coloron : node.config.coloroff,
				  shape: 'dot'
				});
			});
			// Initial read
			input = node.watcher.value ? false : true;
			node.status({
			  fill: input ? node.config.coloron : node.config.coloroff,
			  shape: 'dot'
			}); 
		} catch(err) {
		  node.error('GPIO init error: ' + err.message);
		  node.status({fill: 'red', shape: 'ring', text: 'Error'});
		}
		node.on('close', function(removed, done) {
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
  
    function RelayNode(config) {
		RED.nodes.createNode(this,config);
		const node = this;
		node.relayNumber = parseInt(config.number);
        node.pin = relayNumberPinMapping[config.number];
		node.config = config;
		
		function inputlistener(msg) {
			const out = msg.payload ? true: false;
			if (out === true || out === false){
				if (node.pin){
					// Actionning relay by setting the value of the relay
					node.relay.value = out;
					node.send({ relay:node.relayNumber, status:relayStatusMapping[out], pin: node.pin, payload: out});
					node.status({fill:out ? node.config.coloron : node.config.coloroff, shape:"dot",text: out ? "nrx800.status.closed" : "nrx800.status.open"});
				}
				// Confirm that node is configured to listen on multiple relay to avoid chaotic behavior
				else if (msg.relay !== undefined && node.relays !== undefined){
					const relayNumber = Number.isInteger(msg.relay) ? msg.relay : parseInt(msg.relay);
					if (0 < relayNumber && relayNumber < 9){
						node.debug("Received message for relay "+ relayNumber)
						node.relays[relayNumber].value = out;
						node.send({ relay:relayNumber, status:relayStatusMapping[out], pin: relayNumberPinMapping[relayNumber.toString()], payload: out});
						node.status({fill: out ? node.config.coloron : node.config.coloroff, shape:"dot",text: out ? "nrx800.status.closed" : "nrx800.status.open"});
					} else {
						node.status({fill: "red", shape:"dot",text: "Invalid relay number"});
						node.warn("Received invalid relay number "+relayNumber);
						return
					}
				}
				if (RED.settings.verbose) { node.log("out: "+msg.payload); }
			}
			else { node.warn("Invalid value: "+out+" (Supported value are 0,1,true,false)") }
		}
		
		// node.log("Setup relay ", node.relayNumber, "for GPIO", node.pin);
		if (this.pin !== undefined) {
			node.relay = Default.output({ chip: 0, line: node.pin });
		} else if (config.number == "msg") {
			node.relays = {};
			for (const [key, value] of Object.entries(relayNumberPinMapping)) {
				node.relays[parseInt(key)] = Default.output({ chip: 0, line: value });
			}
		} else {
            this.warn(RED._("pi-gpiod:errors.invalidpin")+": "+this.pin);
        }
		this.on("input", inputlistener);
		this.on('close', (removed, done) => {
			if (node.relay !== undefined) {
				node.relay.stop();
			} else if (node.relays !== undefined) {
				for (const [key, value] of Object.entries(node.relays)) {
					value.stop();
				}
			}
			done();
		});
	}
    RED.nodes.registerType("nrx800-relay",RelayNode);
  
  
    function LedUser(config) {
        RED.nodes.createNode(this,config);
        const node = this;
        node.pio = 19;

        function inputlistener(msg) {
            if (msg.payload === "on")
				msg.payload = true;
            else if (msg.payload === "off")
				msg.payload = false;
            const out = msg.payload ? true : false;
			if (out === true || out === false){
				// revert value since led logic is inverted
				node.led.value = revertDigitalInput(out);
                node.debug("Set user led to "+ledStatusMapping[out]);
                node.status({fill:out ? 'green' : 'grey', shape:"dot", text:out ? "nrx800.status.on" : "nrx800.status.off"});
                node.send({ status:ledStatusMapping[out], payload: out});
            }
            else { node.warn("Invalid value: "+out+" (Supported value are 0,1,true,false,on,off)") }
        }

        node.led = Default.output({ chip: 0, line: node.pio });
		node.led.value = true;
        node.on("input", inputlistener);

        node.on("close", function(removed, done) {
            node.led.stop();
            done();
        });
    }
    RED.nodes.registerType("nrx800-led-user", LedUser);
};