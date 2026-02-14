import { promises as fs } from "fs";
import path from "path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "villaview.jpg");
    const buffer = await fs.readFile(filePath);

    return new Response(buffer, {
      status: 200,
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
