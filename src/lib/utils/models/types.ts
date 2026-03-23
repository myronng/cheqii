export type MutationType =
  | "CREATE_BILL"
  | "UPDATE_BILL"
  | "DELETE_BILL"
  | "ADD_CONTRIBUTOR"
  | "UPDATE_CONTRIBUTOR"
  | "DELETE_CONTRIBUTOR"
  | "ADD_ITEM"
  | "UPDATE_ITEM"
  | "DELETE_ITEM"
  | "ADD_SPLIT"
  | "UPDATE_SPLIT"
  | "LEAVE_BILL"
  | "UPDATE_USER"
  | "DELETE_USER";

export interface Mutation {
  created_at: string;
  entity_id: string;
  id: string;
  payload: any;
  type: MutationType;
  user_id: string;
  seq_id?: number;
}
