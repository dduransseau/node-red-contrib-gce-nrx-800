node-red-contrib-gce-nrx-800
======================

Intégration [Node-RED](http://nodered.org) du NRX-800 de GCE electronics.
L'intégration repose sur [libgpio (v2)](https://libgpiod.readthedocs.io/en/latest) pour controler les entrées et sorties.
Elle permet de piloter les relais et la led user ainsi que recevoir des évenements à chaques changements d'états des entrées numériques.

Repose sur la librairie [opengpio](https://github.com/ExpeditionExploration/opengpio)

#### English version

An [Node-RED](http://nodered.org) nodes to interact with GCE electronics NRX-800 trough [libgpio (v2)](https://libgpiod.readthedocs.io/en/latest)

Allow to control the relays, user led and monitor the digital input of the NRX-800.

Based on [opengpio](https://github.com/ExpeditionExploration/opengpio) library.

### Manual Installation process

```console
nrx800@nrx800:~ $ wget https://github.com/dduransseau/node-red-contrib-gce-nrx-800/archive/refs/heads/main.zip
nrx800@nrx800:~ $ unzip main.zip
nrx800@nrx800:~ $ rm main.zip
nrx800@nrx800:~ $ cd node-red-contrib-gce-nrx-800-main
nrx800@nrx800:~ $ npm install ./
nrx800@nrx800:~ $ cd ~/.node-red
nrx800@nrx800:~/.node-red $ npm install /home/nrx800/node-red-contrib-gce-nrx-800-main
```