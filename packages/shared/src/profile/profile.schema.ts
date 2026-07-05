import { z } from "zod";

export const genders = ["male", "female", "other"] as const;
export type Gender = (typeof genders)[number];

export const vietnamLocations = [
  "Hà Nội",
  "TP. Hồ Chí Minh",
  "Đà Nẵng",
  "Hải Phòng",
  "Cần Thơ",
  "An Giang",
  "Bà Rịa - Vũng Tàu",
  "Bắc Giang",
  "Bắc Kạn",
  "Bạc Liêu",
  "Bắc Ninh",
  "Bến Tre",
  "Bình Định",
  "Bình Dương",
  "Bình Phước",
  "Bình Thuận",
  "Cà Mau",
  "Cao Bằng",
  "Đắk Lắk",
  "Đắk Nông",
  "Điện Biên",
  "Đồng Nai",
  "Đồng Tháp",
  "Gia Lai",
  "Hà Giang",
  "Hà Nam",
  "Hà Tĩnh",
  "Hải Dương",
  "Hậu Giang",
  "Hòa Bình",
  "Hưng Yên",
  "Khánh Hòa",
  "Kiên Giang",
  "Kon Tum",
  "Lai Châu",
  "Lâm Đồng",
  "Lạng Sơn",
  "Lào Cai",
  "Long An",
  "Nam Định",
  "Nghệ An",
  "Ninh Bình",
  "Ninh Thuận",
  "Phú Thọ",
  "Phú Yên",
  "Quảng Bình",
  "Quảng Nam",
  "Quảng Ngãi",
  "Quảng Ninh",
  "Quảng Trị",
  "Sóc Trăng",
  "Sơn La",
  "Tây Ninh",
  "Thái Bình",
  "Thái Nguyên",
  "Thanh Hóa",
  "Thừa Thiên Huế",
  "Tiền Giang",
  "Trà Vinh",
  "Tuyên Quang",
  "Vĩnh Long",
  "Vĩnh Phúc",
  "Yên Bái",
  "Khu vực khác"
] as const;

export const genderSchema = z.enum(genders);

export const chatProfileSchema = z.object({
  displayName: z.string().trim().min(2, "Tên hiển thị cần từ 2 ký tự").max(30, "Tên hiển thị tối đa 30 ký tự"),
  age: z.coerce.number().int().min(18, "Bạn cần đủ 18 tuổi").max(99, "Tuổi chưa hợp lệ"),
  location: z.string().trim().min(2, "Vui lòng chọn tỉnh/thành").max(80, "Nơi ở quá dài"),
  gender: genderSchema,
  desiredGenders: z.array(genderSchema).min(1, "Chọn ít nhất một giới tính muốn trò chuyện").max(3)
});

export type ChatProfile = z.infer<typeof chatProfileSchema>;

export interface ProfileResponse {
  profileComplete: boolean;
  profile: ChatProfile | null;
}
