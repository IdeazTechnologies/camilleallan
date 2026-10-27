import { describe, expect, it } from "vitest";
import { decodeEntities, htmlToMarkdown, htmlToText } from "../../scripts/lib/html-to-markdown";
import { imageSize } from "../../scripts/lib/image-size";

describe("htmlToMarkdown", () => {
  it("converts WooCommerce product descriptions", () => {
    const html = `<p>Little Honey<br />
by Camille Allen</p>
<p><i>How sweet! She&#8217;s fallen asleep.</i></p>
<p><span style="color: #333">(All prices in US Dollars)</span></p>`;
    expect(htmlToMarkdown(html)).toBe("Little Honey\nby Camille Allen\n\n*How sweet! She’s fallen asleep.*\n\n(All prices in US Dollars)");
  });

  it("keeps emphasis on its own line when bold spans a line break", () => {
    expect(htmlToMarkdown("<div><b>One<br>Two</b></div>")).toBe("**One**\n**Two**");
  });

  it("merges adjacent bold runs and nested italics", () => {
    expect(htmlToMarkdown("<div><i><b>Tiny Bundle</b></i><b> WINS award</b></div>")).toBe("***Tiny Bundle* WINS award**");
  });

  it("converts links, images, headings and lists, rewriting URLs", () => {
    const html = `[vc_row][vc_column]<h1>Title</h1><h3>Sub</h3>
<p><a href="http://camilleallen.com/contact/">Contact</a> <img src="http://camilleallen.com/a.jpg" alt="Baby [1]" srcset="x 2x"></p>
<ul><li>One</li><li>Two</li></ul><ol><li>First</li></ol>[/vc_column][/vc_row]`;
    const md = htmlToMarkdown(html, {
      dropFirstHeading: true,
      rewriteUrl: (url, kind) => (kind === "image" ? "/media/1" : url.replace("http://camilleallen.com", "")),
    });
    expect(md).toBe("### Sub\n\n[Contact](/contact/) ![Baby 1](/media/1)\n\n- One\n- Two\n\n1. First");
  });

  it("drops scripts, styles, comments and empty links", () => {
    expect(htmlToMarkdown('<style>p{}</style><!-- x --><script>bad()</script><p>Hi<a href="/x"> </a></p>')).toBe("Hi");
  });
});

describe("entity helpers", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeEntities("Coffee &amp; Tea &#8211; &#x2019;s &nbsp;&unknown;")).toBe("Coffee & Tea – ’s  &unknown;");
    expect(htmlToText("<p>Edition:<br>unlimited</p>")).toBe("Edition: unlimited");
  });
});

describe("imageSize", () => {
  it("reads PNG dimensions", () => {
    const png = Buffer.alloc(24);
    png.writeUInt32BE(0x89504e47, 0);
    png.writeUInt32BE(640, 16);
    png.writeUInt32BE(480, 20);
    expect(imageSize(png)).toEqual({ width: 640, height: 480 });
  });

  it("reads JPEG dimensions after an APP0 segment", () => {
    const jpeg = Buffer.from([
      0xff, 0xd8,
      0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
      0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xc7, 0x02, 0x58, 0x03,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(imageSize(jpeg)).toEqual({ width: 600, height: 455 });
  });

  it("reads GIF dimensions and rejects unknown data", () => {
    const gif = Buffer.alloc(24);
    gif.write("GIF89a", 0, "ascii");
    gif.writeUInt16LE(320, 6);
    gif.writeUInt16LE(200, 8);
    expect(imageSize(gif)).toEqual({ width: 320, height: 200 });
    expect(imageSize(Buffer.alloc(30))).toBeNull();
  });
});
