export interface Bloqueo {
  _id: string;
  blockerId: string;
  blockedId: string;
  createdAt: Date;
}

export interface Seguimiento {
  _id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
}
