import { createCenterBtn, createTextSetting } from "@/settings/utils";
import { Modal } from "obsidian";
import type { App } from "obsidian";
import { extractYtId } from "./utils";

type OnSubmit = (videoId: string) => void;

class YtInputModal extends Modal {
  constructor(app: App, onSubmit: OnSubmit) {
    super(app);

    this.init(onSubmit);
  }

  init(onSubmit: OnSubmit) {
    this.contentEl.empty();

    this.setTitle("Insert video note");

    let videoUrl = "";

    createTextSetting({
      name: "Video URL",
      description: "",
      containerEl: this.contentEl,
      initialValue: "",
      fullWidth: true,
      onChange: (_txt, value) => {
        videoUrl = value;
      },
    });

    createCenterBtn({
      containerEl: this.contentEl,
      cta: true,
      text: "Submit",
      onClick: (_b, e) => {
        e.preventDefault();

        const id = extractYtId(videoUrl);
        if (!id) return;

        this.close();
        onSubmit(id);
      },
    });
  }
}

export default YtInputModal;
