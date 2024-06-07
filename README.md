node-red-contrib-gce-nrx-800
======================

An <a href="http://nodered.org" target="_new">Node-RED</a> nodes to interact with GCE electronics NRX-800 trough
the <a href="http://abyz.me.uk/rpi/pigpio/pigpiod.html" target="_new">PiGPIOd</a> daemon that is part of Raspbian (must be enabled).

To enable the service `sudo systemctl enable pigpiod.service`

### Installation process

```console
nrx800@nrx800:~ $ sudo systemctl enable pigpiod.service
nrx800@nrx800:~ $ sudo systemctl start pigpiod.service
nrx800@nrx800:~ $ wget https://github.com/dduransseau/node-red-contrib-gce-nrx-800/archive/refs/heads/main.zip
nrx800@nrx800:~ $ unzip main.zip
nrx800@nrx800:~ $ rm main.zip
nrx800@nrx800:~ $ cd ~/.node-red
nrx800@nrx800:~/.node-red $ npm install /home/nrx800/node-red-contrib-gce-nrx-800-main
```