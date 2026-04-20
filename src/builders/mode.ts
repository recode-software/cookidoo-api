import type {
  Direction,
  ModeAnnotation,
  ModeData,
  Position,
} from "../types.js";

export type BrowningTemp = 140 | 145 | 150 | 155 | 160;
export type BlendSpeed = "6" | "6.5" | "7" | "7.5" | "8";
export type WarmUpSpeed = "soft" | "1" | "2";
export type SteamingSpeed =
  | "soft"
  | "1"
  | "1.5"
  | "2"
  | "2.5"
  | "3"
  | "3.5"
  | "4"
  | "4.5"
  | "5";

interface Base extends Position {}

function annotation(
  name: ModeAnnotation["name"],
  data: ModeData,
  pos: Position,
): ModeAnnotation {
  return {
    type: "MODE",
    name,
    data,
    position: { offset: pos.offset, length: pos.length },
  };
}

export const mode = {
  /**
   * **Warning:** `name: "manual"` is silently unsupported on custom recipes.
   * The API saves it, but the Cookidoo web/TM7 UI renders the chip with
   * `unsupported=true` (struck-through, red, untappable). Use a concrete
   * mode (`browning`, `steaming`, etc.) where possible, or leave the step
   * as plain text so users can type values on the machine.
   */
  manual(
    args: Base & {
      time: number;
      speed?: string;
      direction?: Direction;
      temperature?: number | "Varoma";
    },
  ): ModeAnnotation {
    const data: ModeData = { time: args.time };
    if (args.speed !== undefined) data.speed = args.speed;
    if (args.direction !== undefined) data.direction = args.direction;
    if (args.temperature !== undefined) {
      data.temperature = {
        value: typeof args.temperature === "number"
          ? String(args.temperature)
          : args.temperature,
        unit: "C",
      };
    }
    return annotation("manual", data, args);
  },

  dough(args: Base & { time: number }): ModeAnnotation {
    return annotation("dough", { time: args.time }, args);
  },

  blend(
    args: Base & { time?: number; speed: BlendSpeed },
  ): ModeAnnotation {
    return annotation(
      "blend",
      { time: args.time ?? 30, speed: args.speed, direction: "CW" },
      args,
    );
  },

  turbo(args: Base & { time: number; pulseCount?: number }): ModeAnnotation {
    const data: ModeData = { time: args.time };
    if (args.pulseCount !== undefined) data.pulseCount = args.pulseCount;
    return annotation("turbo", data, args);
  },

  warmUp(
    args: Base & { temperature: number; speed: WarmUpSpeed },
  ): ModeAnnotation {
    return annotation(
      "warm_up",
      {
        temperature: { value: String(args.temperature), unit: "C" },
        speed: args.speed,
      },
      args,
    );
  },

  riceCooker(args: Base): ModeAnnotation {
    return annotation("rice_cooker", {}, args);
  },

  steaming(
    args: Base & {
      time: number;
      speed: SteamingSpeed;
      direction?: Direction;
      accessory?: "Varoma";
    },
  ): ModeAnnotation {
    const data: ModeData = {
      time: args.time,
      speed: args.speed,
      direction: args.direction ?? "CW",
      accessory: args.accessory ?? "Varoma",
    };
    return annotation("steaming", data, args);
  },

  browning(
    args: Base & {
      time: number;
      temperature: BrowningTemp;
      power?: "Gentle";
    },
  ): ModeAnnotation {
    return annotation(
      "browning",
      {
        time: args.time,
        temperature: { value: String(args.temperature), unit: "C" },
        power: args.power ?? "Gentle",
      },
      args,
    );
  },
};
