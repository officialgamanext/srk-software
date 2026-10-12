import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json(
        { error: "ImageKit private key not configured on server" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const customFileName = formData.get("fileName") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided in form data" },
        { status: 400 }
      );
    }

    const ikFormData = new FormData();
    ikFormData.append("file", file);
    ikFormData.append(
      "fileName",
      customFileName || `product_${Date.now()}_img.webp`
    );
    ikFormData.append("folder", "/products");
    ikFormData.append("useUniqueFileName", "true");

    const authHeader = `Basic ${Buffer.from(privateKey + ":").toString("base64")}`;

    const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      headers: {
        Authorization: authHeader,
      },
      body: ikFormData,
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("ImageKit upload error:", data);
      return NextResponse.json(
        { error: data.message || "Failed to upload to ImageKit" },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      fileId: data.fileId,
      name: data.name,
      url: data.url,
      thumbnailUrl: data.thumbnailUrl,
      size: data.size,
    });
  } catch (err: unknown) {
    console.error("Error in /api/upload:", err);
    const msg = err instanceof Error ? err.message : "Internal upload error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
