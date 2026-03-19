import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Đánh dấu route không cần JWT (vd: sign-in, sign-up) */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
