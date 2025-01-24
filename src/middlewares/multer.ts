import multer from "multer";
import { v4 as uuid } from "uuid";

// const storage = multer.diskStorage({
//   destination(req, file, callback) {
//     callback(null, "uploads");
//   },
//   filename(req, file, callback) {
//     callback(null, `${uuid()}.${file.originalname.split(".").pop()}`);
//   },
// });

export const singleUpload = multer().single("photo");
export const multipleUpload = multer().array("photos", 5);
 