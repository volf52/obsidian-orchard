import { type ButtonComponent, Setting, type TextComponent } from "obsidian";

export const createHeading = (containerEl: HTMLElement, name: string) => {
  const heading = new Setting(containerEl).setName(name).setHeading();

  heading.settingEl.removeChild(heading.controlEl);
  heading.settingEl.style.justifyContent = "center";

  return heading;
};

type SettingCreationArgs = {
  name: string;
  description: string;
  tooltip?: string;
  containerEl: HTMLElement;
};

type TextSettingArgs = SettingCreationArgs & {
  fullWidth?: boolean;
  initialValue: string;
  onChange: (txt: TextComponent, value: string) => void;
};

export const createTextSetting = (args: TextSettingArgs) => {
  const setting = new Setting(args.containerEl)
    .setName(args.name)
    .setDesc(args.description)
    .addText((txt) => {
      if (args.fullWidth) {
        txt.inputEl.style.width = "100%";
      }

      txt
        .setValue(args.initialValue)
        .onChange((val) => args.onChange(txt, val));
    });

  if (args.tooltip) setting.setTooltip(args.tooltip);

  return setting;
};

type CreateCenterBtnArgs = {
  containerEl: HTMLElement;
  text: string;
  cta?: boolean;
  onClick: (b: ButtonComponent, e: MouseEvent) => void;
};
export const createCenterBtn = (args: CreateCenterBtnArgs) => {
  const setting = new Setting(args.containerEl).addButton((b) => {
    if (args.cta) b.setCta();

    b.buttonEl.style.width = "100%";
    b.setButtonText(args.text).onClick((e) => args.onClick(b, e));
  });

  setting.settingEl.removeChild(setting.infoEl);
  setting.settingEl.style.justifyContent = "center";

  return setting;
};
