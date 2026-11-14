import Homey from "homey";

class RdwApp extends Homey.App {
  async onInit(): Promise<void> {
    this.log("[app] initialised");
  }
}

module.exports = RdwApp;
