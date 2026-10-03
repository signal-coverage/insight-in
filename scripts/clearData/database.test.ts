import { describe, expect, it } from "vitest";
import { describeDatabase } from "./database.ts";

describe("describeDatabase", () => {
  it("returns host and database name and never the credentials", () => {
    const info = describeDatabase(
      "postgresql://neondb_owner:s3cr3t-pass@ep-cool-123-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
    );
    expect(info).toEqual({
      host: "ep-cool-123-pooler.us-east-2.aws.neon.tech",
      database: "neondb",
    });
    expect(JSON.stringify(info)).not.toContain("s3cr3t-pass");
    expect(JSON.stringify(info)).not.toContain("neondb_owner");
  });

  it("decodes an encoded database name", () => {
    expect(describeDatabase("postgres://u:p@h.example/my%20db")).toMatchObject({
      database: "my db",
    });
  });

  it("returns null for something that is not a URL, without echoing it", () => {
    expect(describeDatabase("not a url with s3cr3t")).toBeNull();
  });
});
