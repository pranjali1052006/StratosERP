import { NextRequest, NextResponse } from "next/server";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

type ProxyBody = {
  baseUrl?: string;
  path?: string;
  method?: HttpMethod;
  token?: string;
  bodyText?: string;
};

function isHttpMethod(value: string): value is HttpMethod {
  return value === "GET" || value === "POST" || value === "PUT" || value === "DELETE";
}

function appendMultipartFields(formData: FormData, fields: Record<string, unknown>): void {
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (typeof value === "string") {
      formData.append(key, value);
      return;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      formData.append(key, String(value));
      return;
    }

    formData.append(key, JSON.stringify(value));
  });
}

function normalizeTarget(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let baseUrl = "http://localhost:5000";
    let path: string | undefined;
    let method: HttpMethod = "GET";
    let token = "";
    let upstreamBody: BodyInit | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();

      const formBaseUrl = formData.get("baseUrl");
      if (typeof formBaseUrl === "string" && formBaseUrl.trim()) {
        baseUrl = formBaseUrl.trim();
      }

      const formPath = formData.get("path");
      if (typeof formPath === "string") {
        path = formPath.trim();
      }

      const formMethod = formData.get("method");
      if (typeof formMethod === "string") {
        const normalizedMethod = formMethod.trim().toUpperCase();
        if (isHttpMethod(normalizedMethod)) {
          method = normalizedMethod;
        }
      }

      const formToken = formData.get("token");
      if (typeof formToken === "string") {
        token = formToken.trim();
      }

      const fieldsJson = formData.get("fieldsJson");
      let parsedFields: Record<string, unknown> = {};
      if (typeof fieldsJson === "string" && fieldsJson.trim()) {
        try {
          const candidate = JSON.parse(fieldsJson);
          if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
            return NextResponse.json(
              { error: "fieldsJson must be a JSON object." },
              { status: 400 }
            );
          }
          parsedFields = candidate as Record<string, unknown>;
        } catch {
          return NextResponse.json(
            { error: "fieldsJson must be valid JSON." },
            { status: 400 }
          );
        }
      }

      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "file is required for multipart requests." },
          { status: 400 }
        );
      }

      const fileFieldNameValue = formData.get("fileFieldName");
      const fileFieldName =
        typeof fileFieldNameValue === "string" && fileFieldNameValue.trim()
          ? fileFieldNameValue.trim()
          : "file";

      const upstreamFormData = new FormData();
      appendMultipartFields(upstreamFormData, parsedFields);
      upstreamFormData.set(fileFieldName, file, file.name);
      upstreamBody = upstreamFormData;
    } else {
      const body = (await request.json()) as ProxyBody;
      baseUrl = body.baseUrl?.trim() || "http://localhost:5000";
      path = body.path?.trim();
      method = body.method || "GET";
      token = body.token?.trim() || "";

      if (method !== "GET" && method !== "DELETE" && body.bodyText?.trim()) {
        upstreamBody = body.bodyText;
      }
    }

    if (!path) {
      return NextResponse.json(
        { error: "path is required" },
        { status: 400 }
      );
    }

    let parsedBaseUrl: URL;
    try {
      parsedBaseUrl = new URL(baseUrl);
    } catch {
      return NextResponse.json(
        { error: "baseUrl must be a valid URL" },
        { status: 400 }
      );
    }

    if (parsedBaseUrl.protocol !== "http:" && parsedBaseUrl.protocol !== "https:") {
      return NextResponse.json(
        { error: "Only http and https protocols are supported." },
        { status: 400 }
      );
    }

    const target = normalizeTarget(baseUrl, path);

    const headers = new Headers();
    headers.set("Accept", "application/json, text/plain, */*");

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    if (typeof upstreamBody === "string") {
      headers.set("Content-Type", "application/json");
    }

    const startedAt = Date.now();
    const upstream = await fetch(target, {
      method,
      headers,
      body: upstreamBody,
      cache: "no-store",
    });
    const durationMs = Date.now() - startedAt;

    const rawText = await upstream.text();
    let data: unknown = rawText;

    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = rawText;
      }
    } else {
      data = null;
    }

    return NextResponse.json({
      ok: upstream.ok,
      status: upstream.status,
      durationMs,
      target,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected proxy error.",
      },
      { status: 500 }
    );
  }
}
