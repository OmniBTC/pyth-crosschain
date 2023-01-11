import {
  ChainId,
  ChainName,
  toChainId,
  toChainName,
} from "@certusone/wormhole-sdk";
import * as BufferLayout from "@solana/buffer-layout";
import { PACKET_DATA_SIZE } from "@solana/web3.js";
import { ExecutePostedVaa } from "./ExecutePostedVaa";

export interface PythGovernanceAction {
  readonly targetChainId: ChainName;
  encode(): Buffer;
}

export const ExecutorAction = {
  ExecutePostedVaa: 0,
} as const;

export const TargetAction = {
  UpgradeContract: 0,
  AuthorizeGovernanceDataSourceTransfer: 1,
  SetDataSources: 2,
  SetFee: 3,
  SetValidPeriod: 4,
  RequestGovernanceDataSourceTransfer: 5,
} as const;

export function toActionName(
  deserialized: Readonly<{ moduleId: number; actionId: number }>
): ActionName {
  if (deserialized.moduleId == MODULE_EXECUTOR && deserialized.actionId == 0) {
    return "ExecutePostedVaa";
  } else if (deserialized.moduleId == MODULE_TARGET) {
    switch (deserialized.actionId) {
      case 0:
        return "UpgradeContract";
      case 1:
        return "AuthorizeGovernanceDataSourceTransfer";
      case 2:
        return "SetDataSources";
      case 3:
        return "SetFee";
      case 4:
        return "SetValidPeriod";
      case 5:
        return "RequestGovernanceDataSourceTransfer";
    }
  }
  throw new Error("Invalid header, action doesn't match module");
}
export declare type ActionName =
  | keyof typeof ExecutorAction
  | keyof typeof TargetAction;

export const MAGIC_NUMBER = 0x4d475450;
export const MODULE_EXECUTOR = 0;
export const MODULE_TARGET = 1;

export class PythGovernanceHeader {
  readonly targetChainId: ChainName;
  readonly action: ActionName;
  static layout: BufferLayout.Structure<
    Readonly<{
      magicNumber: number;
      module: number;
      action: number;
      chain: ChainId;
    }>
  > = BufferLayout.struct(
    [
      BufferLayout.u32("magicNumber"),
      BufferLayout.u8("module"),
      BufferLayout.u8("action"),
      BufferLayout.u16be("chain"),
    ],
    "header"
  );

  constructor(targetChainId: ChainName, action: ActionName) {
    this.targetChainId = targetChainId;
    this.action = action;
  }
  /** Decode Pyth Governance Header */
  static decode(data: Buffer): PythGovernanceHeader {
    let deserialized = this.layout.decode(data);
    return this.verify(deserialized);
  }

  /** Verify header fields, takes in a raw deserialized header  */
  static verify(
    deserialized: Readonly<{
      magicNumber: number;
      module: number;
      action: number;
      chain: ChainId;
    }>
  ): PythGovernanceHeader {
    if (deserialized.magicNumber !== MAGIC_NUMBER) {
      throw new Error("Wrong magic number");
    }

    if (!toChainName(deserialized.chain)) {
      throw new Error("Chain Id not found");
    }

    return new PythGovernanceHeader(
      toChainName(deserialized.chain),
      toActionName({
        actionId: deserialized.action,
        moduleId: deserialized.module,
      })
    );
  }

  encode(): Buffer {
    // The code will crash if the payload is actually bigger than PACKET_DATA_SIZE. But PACKET_DATA_SIZE is the maximum transaction size of Solana, so our serialized payload should never be bigger than this anyway
    const buffer = Buffer.alloc(PACKET_DATA_SIZE);
    let module: number;
    let action: number;
    if (this.action in ExecutorAction) {
      module = MODULE_EXECUTOR;
      action = ExecutorAction[this.action as keyof typeof ExecutorAction];
    } else {
      module = MODULE_TARGET;
      action = TargetAction[this.action as keyof typeof TargetAction];
    }
    const span = PythGovernanceHeader.layout.encode(
      {
        magicNumber: MAGIC_NUMBER,
        module,
        action,
        chain: toChainId(this.targetChainId),
      },
      buffer
    );
    return buffer.subarray(0, span);
  }
}

export function decodeGovernancePayload(data: Buffer): PythGovernanceAction {
  const header = PythGovernanceHeader.decode(data);
  switch (header.action) {
    case "ExecutePostedVaa":
      return ExecutePostedVaa.decode(data);
    default:
      throw "Not supported";
  }
}

export { ExecutePostedVaa } from "./ExecutePostedVaa";