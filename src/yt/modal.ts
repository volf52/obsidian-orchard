import { Modal, Notice, Setting } from "obsidian";
import type { App } from "obsidian";
import { extractYtId } from "./utils";

type OnSubmit = (videoId: string) => void;

class YtInputModal extends Modal {
  constructor(app: App, onSubmit: OnSubmit) {
    super(app);

    this.init(onSubmit);
  }

  init(onSubmit: OnSubmit) {
    this.setTitle("Insert video note");

    let videoUrl = "";

    new Setting(this.contentEl).setName("URL").addText((txt) => {
      txt.onChange((val) => {
        videoUrl = val;
      });
    });

    new Setting(this.contentEl).addButton((btn) => {
      btn
        .setButtonText("Submit")
        .setCta()
        .onClick((e) => {
          e.preventDefault();

          const id = extractYtId(videoUrl);
          if (id) {
            this.close();
            onSubmit(id);
          } else {
            new Notice("Invalid URL");
          }
        });
    });
  }
}

export default YtInputModal;
