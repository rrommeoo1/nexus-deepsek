# Generates the Jungle Book mark from the single source photograph, with no field behind it.
#
# The source is a JPEG of the letters J and B made of tropical fruit on a dark green field. The app
# needs the letters alone, because they sit on black in the header, inside the create circle and on
# the login screen. Everything below runs on System.Drawing, which ships with Windows, so the
# pipeline stays free; the pixel loops are C# compiled in memory by Add-Type, because PowerShell
# would take minutes to walk 915k pixels.
#
# The steps are the ones the brief asks for:
#
#   1. the field colour is the median of the border band, with its measured deviation (sigma);
#   2. every pixel gets its RGB distance to that field; the alpha ramp runs from -LowCut (fully
#      transparent) to -HighCut (fully opaque), both derived from sigma, of the order of 18 and 48;
#   3. connected components of field-like pixels are emptied when they touch the image border or
#      are larger than 0.15% of the picture (this also empties the counters of the letters and the
#      gaps between fruits); the small ones stay fully opaque, so dark leaves and shadows survive;
#   4. the colour of the semi-transparent edge is re-derived from the field, F = (C - (1-a)*field)/a,
#      so no dark green halo is left on the rope;
#   5. opaque specks under -MinSpeck pixels are deleted, the edge is smoothed over one pixel, and the
#      result is cropped tight on its own alpha box with a 4% margin, as a transparent square;
#   6. every size the app and Android need is written, then measured, and one JSON report is printed.
#
# It prints one JSON object on stdout; tools/brand/make-assets.mjs checks the numbers and writes
# stats.json, which scripts/test-brand-assets.cjs enforces.

param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [int]$MinSpeck = 20,
  [int]$MarginPercent = 4
)

$ErrorActionPreference = 'Stop'
trap {
  Write-Host ("make-assets.ps1 failed at line {0}: {1}" -f $_.InvocationInfo.ScriptLineNumber, $_.Exception.Message)
  exit 1
}
Add-Type -AssemblyName System.Drawing

$csharp = @'
// Jungle Book mark: the letters of the photograph on transparency.
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

public static class JBMark
{
    static int W, H;
    static byte[] SR, SG, SB;
    static float[] Dist, Alpha;
    static int FieldR, FieldG, FieldB;
    static float Sigma, LowCut, HighCut;

    public static string Run(string sourcePath, string outDir, int minSpeck, int marginPercent)
    {
        Directory.CreateDirectory(outDir);
        Load(sourcePath);
        MeasureField();
        BuildDistance();
        int fieldPixels = DropField();
        BuildBinaryAlpha();
        DespeckleMask();
        Antialias();
        int specks = DropSpecks(minSpeck);
        Decontaminate();
        return WriteEverything(outDir, AlphaBox(8), marginPercent, fieldPixels, specks);
    }
    static void Load(string sourcePath)
    {
        using (Bitmap src = new Bitmap(sourcePath))
        {
            W = src.Width; H = src.Height;
            Rectangle rect = new Rectangle(0, 0, W, H);
            using (Bitmap copy = new Bitmap(W, H, PixelFormat.Format24bppRgb))
            {
                using (Graphics g = Graphics.FromImage(copy)) { g.DrawImage(src, rect); }
                BitmapData data = copy.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
                try
                {
                    int stride = Math.Abs(data.Stride);
                    byte[] buffer = new byte[stride * H];
                    Marshal.Copy(data.Scan0, buffer, 0, buffer.Length);
                    SR = new byte[W * H]; SG = new byte[W * H]; SB = new byte[W * H];
                    for (int y = 0; y < H; y++)
                    {
                        int row = (data.Stride < 0 ? (H - 1 - y) : y) * stride;
                        for (int x = 0; x < W; x++)
                        {
                            int i = row + x * 3; int o = y * W + x;
                            SB[o] = buffer[i]; SG[o] = buffer[i + 1]; SR[o] = buffer[i + 2];
                        }
                    }
                }
                finally { copy.UnlockBits(data); }
            }
        }
    }

    static int Median(int[] histogram, int count)
    {
        int running = 0;
        for (int v = 0; v < 256; v++)
        {
            running += histogram[v];
            if (running * 2 >= count) return v;
        }
        return 0;
    }

    // The field is the median of a band along the four edges, not of one corner: a JPEG vignettes.
    static void MeasureField()
    {
        int band = Math.Max(4, Math.Min(W, H) / 64);
        int[] hr = new int[256], hg = new int[256], hb = new int[256];
        int n = 0;
        for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++)
            {
                if (x >= band && y >= band && x < W - band && y < H - band) continue;
                int o = y * W + x;
                hr[SR[o]]++; hg[SG[o]]++; hb[SB[o]]++; n++;
            }
        FieldR = Median(hr, n); FieldG = Median(hg, n); FieldB = Median(hb, n);

        double sum = 0;
        for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++)
            {
                if (x >= band && y >= band && x < W - band && y < H - band) continue;
                int o = y * W + x;
                double dr = SR[o] - FieldR, dg = SG[o] - FieldG, db = SB[o] - FieldB;
                sum += dr * dr + dg * dg + db * db;
            }
        Sigma = (float)Math.Sqrt(sum / Math.Max(1, n));

        LowCut = (float)Math.Round(Sigma * 2.5 + 8.0);
        if (LowCut < 12f) LowCut = 12f;
        if (LowCut > 22f) LowCut = 22f;
        HighCut = (float)Math.Round(LowCut * 2.6);
        if (HighCut < LowCut + 18f) HighCut = LowCut + 18f;
        if (HighCut > 60f) HighCut = 60f;
    }

    static void BuildDistance()
    {
        int n = W * H;
        Dist = new float[n];
        Alpha = new float[n];
        for (int o = 0; o < n; o++)
        {
            float dr = SR[o] - FieldR, dg = SG[o] - FieldG, db = SB[o] - FieldB;
            Dist[o] = (float)Math.Sqrt(dr * dr + dg * dg + db * db);
        }
    }
    // 0 = not decided yet, 1 = a kept island inside the drawing, 2 = field (empty).
    static byte[] State;

    // The alpha is one solid pixel with a one-pixel antialiased rope, not a linear ramp over the
    // distance: measured on this photograph, a linear ramp between the two cuts produced a border
    // 49 px wide (the soft shadows around the fruit drift slowly through the band), and every leaf
    // caught in that band would have gone half transparent and disappeared on the app's black.
    // The distance still decides membership — -LowCut is the edge, -HighCut is what counts as
    // field-like for the component pass below — and the rope is then one pixel by construction.
    static void BuildBinaryAlpha()
    {
        int n = W * H;
        for (int o = 0; o < n; o++)
        {
            if (State[o] == 2) Alpha[o] = 0f;
            else if (State[o] == 1) Alpha[o] = 1f;
            else Alpha[o] = Dist[o] > LowCut ? 1f : 0f;
        }
    }

    // A majority vote on the solid mask with a two-pixel radius. Without it the soft shadow around
    // the fruit — where the distance drifts back and forth across the cut — is a ragged staircase
    // of one-pixel steps, and the antialias below turns that staircase into an eight-pixel haze
    // instead of an edge. A vote also rounds the outline by at most two pixels, which is invisible
    // at 36 dp and cheaper than any morphological open/close pair.
    static void DespeckleMask()
    {
        int n = W * H;
        float[] clean = new float[n];
        const int radius = 2;
        for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++)
            {
                float sum = 0f; int count = 0;
                for (int dy = -radius; dy <= radius; dy++)
                {
                    int yy = y + dy; if (yy < 0 || yy >= H) continue;
                    for (int dx = -radius; dx <= radius; dx++)
                    {
                        int xx = x + dx; if (xx < 0 || xx >= W) continue;
                        sum += Alpha[yy * W + xx]; count++;
                    }
                }
                clean[y * W + x] = sum * 2f > count ? 1f : 0f;
            }
        Alpha = clean;
    }

    // One 3x3 average of the solid mask: interiors stay exactly 1 and the field exactly 0, so the
    // only partial pixels are the single ring where the two meet.
    static void Antialias()
    {
        int n = W * H;
        float[] blurred = new float[n];
        for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++)
            {
                float sum = 0f; int count = 0;
                for (int dy = -1; dy <= 1; dy++)
                {
                    int yy = y + dy; if (yy < 0 || yy >= H) continue;
                    for (int dx = -1; dx <= 1; dx++)
                    {
                        int xx = x + dx; if (xx < 0 || xx >= W) continue;
                        sum += Alpha[yy * W + xx]; count++;
                    }
                }
                blurred[y * W + x] = sum / count;
            }
        Alpha = blurred;
    }
    // Empties the field: every connected blob of field-like pixels that touches the border, or is
    // bigger than 0.15% of the picture (the counters of the letters, the gaps between fruits).
    // The small blobs that survive are dark leaves and shadows inside the drawing, so they become
    // fully opaque instead of a faint wash that would vanish on the app's black.
    static int DropField()
    {
        int n = W * H;
        State = new byte[n];
        byte[] seen = new byte[n];
        int[] stack = new int[n];
        int[] members = new int[1024];
        float bigCut = n * 0.0015f;
        int fieldPixels = 0;
        for (int start = 0; start < n; start++)
        {
            if (seen[start] != 0 || Dist[start] > HighCut) continue;
            int top = 0; stack[top++] = start; seen[start] = 1;
            int count = 0; bool touches = false;
            while (top > 0)
            {
                int p = stack[--top];
                if (count == members.Length) Array.Resize(ref members, members.Length * 2);
                members[count++] = p;
                int px = p % W, py = p / W;
                if (px == 0 || py == 0 || px == W - 1 || py == H - 1) touches = true;
                if (px > 0) { int q = p - 1; if (seen[q] == 0 && Dist[q] <= HighCut) { seen[q] = 1; stack[top++] = q; } }
                if (px < W - 1) { int q = p + 1; if (seen[q] == 0 && Dist[q] <= HighCut) { seen[q] = 1; stack[top++] = q; } }
                if (py > 0) { int q = p - W; if (seen[q] == 0 && Dist[q] <= HighCut) { seen[q] = 1; stack[top++] = q; } }
                if (py < H - 1) { int q = p + W; if (seen[q] == 0 && Dist[q] <= HighCut) { seen[q] = 1; stack[top++] = q; } }
            }
            bool isField = touches || count > bigCut;
            for (int i = 0; i < count; i++)
            {
                if (isField) { State[members[i]] = 2; fieldPixels++; }
                else State[members[i]] = 1;
            }
        }
        return fieldPixels;
    }

    // Deletes opaque islands smaller than -MinSpeck: JPEG grain between the fruits, not drawing.
    static int DropSpecks(int minPixels)
    {
        int n = W * H;
        byte[] seen = new byte[n];
        int[] stack = new int[n];
        int[] members = new int[256];
        int removed = 0;
        for (int start = 0; start < n; start++)
        {
            if (seen[start] != 0 || Alpha[start] <= 0f) continue;
            int top = 0; stack[top++] = start; seen[start] = 1; int count = 0;
            while (top > 0)
            {
                int p = stack[--top];
                if (count == members.Length) Array.Resize(ref members, members.Length * 2);
                members[count++] = p;
                int px = p % W, py = p / W;
                if (px > 0) { int q = p - 1; if (seen[q] == 0 && Alpha[q] > 0f) { seen[q] = 1; stack[top++] = q; } }
                if (px < W - 1) { int q = p + 1; if (seen[q] == 0 && Alpha[q] > 0f) { seen[q] = 1; stack[top++] = q; } }
                if (py > 0) { int q = p - W; if (seen[q] == 0 && Alpha[q] > 0f) { seen[q] = 1; stack[top++] = q; } }
                if (py < H - 1) { int q = p + W; if (seen[q] == 0 && Alpha[q] > 0f) { seen[q] = 1; stack[top++] = q; } }
            }
            if (count < minPixels)
            {
                for (int i = 0; i < count; i++) Alpha[members[i]] = 0f;
                removed++;
            }
        }
        return removed;
    }

    // The speck floor scales with the file: 20 px at the native 681 px crop, never less than 20 in a
    // small icon, where a 20 px island is still small enough to be fringe rather than a fruit.
    static int SpeckFloor(int size)
    {
        int scaled = (int)Math.Round(20.0 * size / 681.0);
        return Math.Max(20, scaled);
    }

    // After a resize the one-pixel rope can break into one- or two-pixel islands (the fringe of a
    // thin leaf landing in a single output pixel). Anything under -minPixels is fringe, not drawing,
    // so it is cleared here and every file ships with no isolated speck at all.
    static void TrimResized(float[] a, int w, int h, int minPixels)
    {
        // 0.5/255 is the threshold the PNG writer uses, so an island that survives here also
        // survives quantization and the report and the trim agree on what a speck is.
        const float ink = 0.5f / 255f;
        int n = w * h;
        byte[] seen = new byte[n];
        int[] stack = new int[n];
        int[] members = new int[256];
        for (int start = 0; start < n; start++)
        {
            if (seen[start] != 0 || a[start] <= ink) continue;
            int top = 0; stack[top++] = start; seen[start] = 1; int count = 0;
            while (top > 0)
            {
                int p = stack[--top];
                if (count == members.Length) Array.Resize(ref members, members.Length * 2);
                members[count++] = p;
                int px = p % w, py = p / w;
                if (px > 0) { int q = p - 1; if (seen[q] == 0 && a[q] > ink) { seen[q] = 1; stack[top++] = q; } }
                if (px < w - 1) { int q = p + 1; if (seen[q] == 0 && a[q] > ink) { seen[q] = 1; stack[top++] = q; } }
                if (py > 0) { int q = p - w; if (seen[q] == 0 && a[q] > ink) { seen[q] = 1; stack[top++] = q; } }
                if (py < h - 1) { int q = p + w; if (seen[q] == 0 && a[q] > ink) { seen[q] = 1; stack[top++] = q; } }
            }
            if (count < minPixels)
                for (int i = 0; i < count; i++) a[members[i]] = 0f;
        }
    }

    // Removes the field from the colour of the edge: F = (C - (1-a)*field)/a, clamped to 0..255.
    // Without this the rope keeps a dark green rim that reads as a halo on black.
    static void Decontaminate()
    {
        int n = W * H;
        for (int o = 0; o < n; o++)
        {
            float a = Alpha[o];
            if (a <= 0f || a >= 1f) continue;
            float r = (SR[o] - (1f - a) * FieldR) / a;
            float g = (SG[o] - (1f - a) * FieldG) / a;
            float b = (SB[o] - (1f - a) * FieldB) / a;
            SR[o] = (byte)Clamp255(r); SG[o] = (byte)Clamp255(g); SB[o] = (byte)Clamp255(b);
        }
    }

    static float Clamp255(float value)
    {
        if (value <= 0f) return 0f;
        if (value >= 255f) return 255f;
        return value;
    }

    // The tight box around everything visible, squared and grown by the margin.
    static int[] AlphaBox(int minAlphaByte)
    {
        int minX = W, minY = H, maxX = -1, maxY = -1;
        for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++)
            {
                if (Alpha[y * W + x] * 255f < minAlphaByte) continue;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        return new int[] { minX, minY, maxX, maxY };
    }
    static string WriteEverything(string outDir, int[] box, int marginPercent, int fieldPixels, int specks)
    {
        int bw = box[2] - box[0] + 1, bh = box[3] - box[1] + 1;
        int margin = (int)Math.Round(Math.Max(bw, bh) * marginPercent / 100.0);
        int side = Math.Min(Math.Max(bw, bh) + 2 * margin, Math.Min(W, H));
        int cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2;
        int cropX = Math.Min(Math.Max(cx - side / 2, 0), W - side);
        int cropY = Math.Min(Math.Max(cy - side / 2, 0), H - side);

        // The crop goes to premultiplied colour straight away: every resize below averages
        // premultiplied values, which is the only way a bicubic or a box filter does not drag the
        // colour of the empty field into the edge of the fruit.
        float[] mr = new float[side * side], mg = new float[side * side];
        float[] mb = new float[side * side], ma = new float[side * side];
        for (int y = 0; y < side; y++)
            for (int x = 0; x < side; x++)
            {
                int s = (cropY + y) * W + cropX + x;
                int o = y * side + x;
                float a = Alpha[s];
                ma[o] = a;
                mr[o] = SR[s] * a / 255f; mg[o] = SG[s] * a / 255f; mb[o] = SB[s] * a / 255f;
            }

        float[] r1024, g1024, b1024, a1024;
        ResizeArgb(mr, mg, mb, ma, side, side, 1024, 1024, out r1024, out g1024, out b1024, out a1024);
        TrimResized(a1024, 1024, 1024, SpeckFloor(1024));
        SavePng(Path.Combine(outDir, "jb-mark-1024.png"), 1024, 1024, r1024, g1024, b1024, a1024);

        float[] rx, gx, bx, ax;
        ResizeArgb(mr, mg, mb, ma, side, side, 512, 512, out rx, out gx, out bx, out ax);
        TrimResized(ax, 512, 512, SpeckFloor(512));
        SavePng(Path.Combine(outDir, "jb-mark-512.png"), 512, 512, rx, gx, bx, ax);

        // 36 dp for the header, 40 dp for the create button, each at 1x/2x/3x.
        int[] headerSizes = new int[] { 36, 72, 108 };
        int[] navSizes = new int[] { 40, 80, 120 };
        for (int i = 0; i < 3; i++)
        {
            ResizeArgb(mr, mg, mb, ma, side, side, headerSizes[i], headerSizes[i], out rx, out gx, out bx, out ax);
            TrimResized(ax, headerSizes[i], headerSizes[i], SpeckFloor(headerSizes[i]));
            SavePng(Path.Combine(outDir, string.Format(CultureInfo.InvariantCulture, "jb-mark-header-{0}x.png", i + 1)),
                    headerSizes[i], headerSizes[i], rx, gx, bx, ax);
            ResizeArgb(mr, mg, mb, ma, side, side, navSizes[i], navSizes[i], out rx, out gx, out bx, out ax);
            TrimResized(ax, navSizes[i], navSizes[i], SpeckFloor(navSizes[i]));
            SavePng(Path.Combine(outDir, string.Format(CultureInfo.InvariantCulture, "jb-mark-nav-{0}x.png", i + 1)),
                    navSizes[i], navSizes[i], rx, gx, bx, ax);
        }

        // Adaptive icon: the letters inside Android's 66% safe zone, on transparency; the launcher
        // paints the field behind them and the monochrome layer is the same silhouette in white.
        SaveInset(Path.Combine(outDir, "jb-icon-foreground-1024.png"), 1024, r1024, g1024, b1024, a1024, 0.66, false);
        SaveInset(Path.Combine(outDir, "jb-icon-monochrome-1024.png"), 1024, r1024, g1024, b1024, a1024, 0.66, true);
        SaveSolid(Path.Combine(outDir, "jb-icon-background-1024.png"), 1024, 0x02, 0x15, 0x0D);
        // The square icon that older launchers show: the same drawing on the same field.
        SaveOnField(Path.Combine(outDir, "jb-icon-1024.png"), 1024, r1024, g1024, b1024, a1024, 0.72);
        // Android 12+ splash: the mark alone; the field behind it comes from app.json's plugin.
        SaveInset(Path.Combine(outDir, "jb-splash-512.png"), 512, r1024, g1024, b1024, a1024, 1.0, false);

        return Report(outDir, box, cropX, cropY, side, margin, fieldPixels, specks);
    }
    // Box filter when shrinking, bilinear when growing, always on premultiplied values.
    static void ResizeArgb(float[] sr, float[] sg, float[] sb, float[] sa, int iw, int ih, int ow, int oh,
                           out float[] dr, out float[] dg, out float[] db, out float[] da)
    {
        int n = ow * oh;
        dr = new float[n]; dg = new float[n]; db = new float[n]; da = new float[n];
        bool shrinking = ow < iw || oh < ih;
        for (int y = 0; y < oh; y++)
        {
            for (int x = 0; x < ow; x++)
            {
                float pr = 0f, pg = 0f, pb = 0f, pa = 0f;
                if (shrinking)
                {
                    int x0 = (int)((long)x * iw / ow), x1 = (int)((long)(x + 1) * iw / ow);
                    int y0 = (int)((long)y * ih / oh), y1 = (int)((long)(y + 1) * ih / oh);
                    if (x1 <= x0) x1 = x0 + 1;
                    if (y1 <= y0) y1 = y0 + 1;
                    int count = 0;
                    for (int sy = y0; sy < y1 && sy < ih; sy++)
                        for (int sx = x0; sx < x1 && sx < iw; sx++)
                        {
                            int s = sy * iw + sx; float a = sa[s];
                            pr += sr[s]; pg += sg[s]; pb += sb[s]; pa += a; count++;
                        }
                    if (count > 0) { pr /= count; pg /= count; pb /= count; pa /= count; }
                }
                else
                {
                    float fx = ((x + 0.5f) * iw / ow) - 0.5f;
                    float fy = ((y + 0.5f) * ih / oh) - 0.5f;
                    int x0 = (int)Math.Floor(fx), y0 = (int)Math.Floor(fy);
                    float tx = fx - x0, ty = fy - y0;
                    for (int k = 0; k < 4; k++)
                    {
                        int sx = x0 + (k & 1), sy = y0 + (k >> 1);
                        if (sx < 0) sx = 0; if (sx >= iw) sx = iw - 1;
                        if (sy < 0) sy = 0; if (sy >= ih) sy = ih - 1;
                        float w = ((k & 1) == 0 ? 1f - tx : tx) * ((k >> 1) == 0 ? 1f - ty : ty);
                        int s = sy * iw + sx;
                        pr += sr[s] * w; pg += sg[s] * w; pb += sb[s] * w; pa += sa[s] * w;
                    }
                }
                int o = y * ow + x;
                dr[o] = pr; dg[o] = pg; db[o] = pb; da[o] = pa;
            }
        }
    }

    static byte ToByte(float unit)
    {
        float scaled = unit * 255f;
        if (scaled <= 0f) return 0;
        if (scaled >= 255f) return 255;
        return (byte)Math.Round(scaled);
    }
    // Writes premultiplied floats as a straight-alpha PNG.
    static void SavePng(string path, int w, int h, float[] pr, float[] pg, float[] pb, float[] pa)
    {
        using (Bitmap bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb))
        {
            Rectangle rect = new Rectangle(0, 0, w, h);
            BitmapData data = bmp.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
            try
            {
                int stride = Math.Abs(data.Stride);
                byte[] buffer = new byte[stride * h];
                for (int y = 0; y < h; y++)
                {
                    int row = (data.Stride < 0 ? (h - 1 - y) : y) * stride;
                    for (int x = 0; x < w; x++)
                    {
                        int o = y * w + x, i = row + x * 4;
                        float a = pa[o];
                        if (a <= 0.0005f) continue;
                        buffer[i] = ToByte(pb[o] / a);
                        buffer[i + 1] = ToByte(pg[o] / a);
                        buffer[i + 2] = ToByte(pr[o] / a);
                        buffer[i + 3] = ToByte(a);
                    }
                }
                Marshal.Copy(buffer, 0, data.Scan0, buffer.Length);
            }
            finally { bmp.UnlockBits(data); }
            bmp.Save(path, ImageFormat.Png);
        }
    }

    static void SaveSolid(string path, int size, int r, int g, int b)
    {
        int n = size * size;
        float[] pr = new float[n], pg = new float[n], pb = new float[n], pa = new float[n];
        for (int o = 0; o < n; o++) { pr[o] = r / 255f; pg[o] = g / 255f; pb[o] = b / 255f; pa[o] = 1f; }
        SavePng(path, size, size, pr, pg, pb, pa);
    }

    // The mark inset on a transparent canvas: the adaptive foreground and the monochrome layer.
    static void SaveInset(string path, int canvas, float[] pr, float[] pg, float[] pb, float[] pa, double fraction, bool white)
    {
        int inner = (int)Math.Round(canvas * fraction);
        if (inner > canvas) inner = canvas;
        int offset = (canvas - inner) / 2;
        float[] ir, ig, ib, ia;
        ResizeArgb(pr, pg, pb, pa, 1024, 1024, inner, inner, out ir, out ig, out ib, out ia);
        TrimResized(ia, inner, inner, SpeckFloor(inner));
        int n = canvas * canvas;
        float[] cr = new float[n], cg = new float[n], cb = new float[n], ca = new float[n];
        for (int y = 0; y < inner; y++)
            for (int x = 0; x < inner; x++)
            {
                int s = y * inner + x, o = (y + offset) * canvas + (x + offset);
                float a = ia[s];
                ca[o] = a;
                if (white) { cr[o] = a; cg[o] = a; cb[o] = a; }
                else { cr[o] = ir[s]; cg[o] = ig[s]; cb[o] = ib[s]; }
            }
        SavePng(path, canvas, canvas, cr, cg, cb, ca);
    }

    // The square launcher icon: the mark over the field the photograph had.
    static void SaveOnField(string path, int canvas, float[] pr, float[] pg, float[] pb, float[] pa, double fraction)
    {
        int inner = (int)Math.Round(canvas * fraction);
        int offset = (canvas - inner) / 2;
        float[] ir, ig, ib, ia;
        ResizeArgb(pr, pg, pb, pa, 1024, 1024, inner, inner, out ir, out ig, out ib, out ia);
        float fr = FieldR / 255f, fg = FieldG / 255f, fb = FieldB / 255f;
        int n = canvas * canvas;
        float[] cr = new float[n], cg = new float[n], cb = new float[n], ca = new float[n];
        for (int o = 0; o < n; o++) { cr[o] = fr; cg[o] = fg; cb[o] = fb; ca[o] = 1f; }
        for (int y = 0; y < inner; y++)
            for (int x = 0; x < inner; x++)
            {
                int s = y * inner + x, o = (y + offset) * canvas + (x + offset);
                float a = ia[s];
                cr[o] = ir[s] + (1f - a) * fr;
                cg[o] = ig[s] + (1f - a) * fg;
                cb[o] = ib[s] + (1f - a) * fb;
                ca[o] = 1f;
            }
        SavePng(path, canvas, canvas, cr, cg, cb, ca);
    }
    static float[] ReadAlpha(string path, out int w, out int h)
    {
        using (Bitmap bmp = new Bitmap(path))
        {
            w = bmp.Width; h = bmp.Height;
            float[] alpha = new float[w * h];
            Rectangle rect = new Rectangle(0, 0, w, h);
            BitmapData data = bmp.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            try
            {
                int stride = Math.Abs(data.Stride);
                byte[] buffer = new byte[stride * h];
                Marshal.Copy(data.Scan0, buffer, 0, buffer.Length);
                for (int y = 0; y < h; y++)
                {
                    int row = (data.Stride < 0 ? (h - 1 - y) : y) * stride;
                    for (int x = 0; x < w; x++) alpha[y * w + x] = buffer[row + x * 4 + 3] / 255f;
                }
            }
            finally { bmp.UnlockBits(data); }
            return alpha;
        }
    }

    // What the test asks about a transparent file: how empty it is, how wide the edge rope is, and
    // whether any visible island is smaller than a speck.
    static void AlphaStats(float[] a, int w, int h, int minSpeck, out float transparent, out int rampPx, out float hazeFraction, out int specks)
    {
        int clear = 0;
        for (int o = 0; o < a.Length; o++) if (a[o] <= 0f) clear++;
        transparent = (float)clear / a.Length;

        // How far a half-transparent pixel is from both ends of the transition. On a one-pixel rope
        // every partial pixel touches solid and empty, so this is 1; a wide translucent band leaves
        // pixels in its middle that are far from both, which is exactly the haze this check forbids.
        int[] fromEmpty = Chebyshev(a, w, h, false);
        int[] fromSolid = Chebyshev(a, w, h, true);
        int[] histogram = new int[65];
        int partial = 0;
        long haze = 0;
        for (int o = 0; o < a.Length; o++)
        {
            if (!(a[o] > 0f && a[o] < 1f)) continue;
            partial++;
            int thin = Math.Min(fromEmpty[o], fromSolid[o]);
            if (thin > 64) thin = 64;
            histogram[thin]++;
            // A pixel that is far from solid and far from empty belongs to a wide translucent band.
            if (fromEmpty[o] > 3 && fromSolid[o] > 3) haze++;
        }
        // The ninetieth percentile of that distance: the rope is this thin at nine edges in ten.
        rampPx = 0;
        int running = 0;
        for (int i = 0; i < histogram.Length; i++)
        {
            running += histogram[i];
            if (running * 10 >= partial * 9) { rampPx = i; break; }
        }
        hazeFraction = partial > 0 ? (float)haze / partial : 0f;

        byte[] seen = new byte[a.Length];
        int[] stack = new int[a.Length];
        specks = 0;
        for (int start = 0; start < a.Length; start++)
        {
            if (seen[start] != 0 || a[start] <= 0f) continue;
            int top = 0; stack[top++] = start; seen[start] = 1; int count = 0;
            while (top > 0)
            {
                int p = stack[--top]; count++;
                int px = p % w, py = p / w;
                if (px > 0) { int q = p - 1; if (seen[q] == 0 && a[q] > 0f) { seen[q] = 1; stack[top++] = q; } }
                if (px < w - 1) { int q = p + 1; if (seen[q] == 0 && a[q] > 0f) { seen[q] = 1; stack[top++] = q; } }
                if (py > 0) { int q = p - w; if (seen[q] == 0 && a[q] > 0f) { seen[q] = 1; stack[top++] = q; } }
                if (py < h - 1) { int q = p + w; if (seen[q] == 0 && a[q] > 0f) { seen[q] = 1; stack[top++] = q; } }
            }
            if (count < minSpeck) specks++;
        }
    }
    // Chebyshev distance (eight neighbours) from every pixel to the nearest solid or empty pixel.
    static int[] Chebyshev(float[] a, int w, int h, bool solid)
    {
        int n = w * h;
        int[] dist = new int[n];
        int[] queue = new int[n];
        int head = 0, tail = 0;
        for (int o = 0; o < n; o++)
        {
            bool source = solid ? a[o] >= 1f : a[o] <= 0f;
            if (source) { dist[o] = 0; queue[tail++] = o; }
            else dist[o] = int.MaxValue;
        }
        while (head < tail)
        {
            int p = queue[head++];
            int px = p % w, py = p / w;
            int nd = dist[p] + 1;
            for (int dy = -1; dy <= 1; dy++)
            {
                int yy = py + dy; if (yy < 0 || yy >= h) continue;
                for (int dx = -1; dx <= 1; dx++)
                {
                    int xx = px + dx; if (xx < 0 || xx >= w) continue;
                    if (dx == 0 && dy == 0) continue;
                    int q = yy * w + xx;
                    if (dist[q] <= nd) continue;
                    dist[q] = nd;
                    if (tail == queue.Length) Array.Resize(ref queue, queue.Length * 2);
                    queue[tail++] = q;
                }
            }
        }
        return dist;
    }

    // The deepest pixel of each of the two biggest opaque islands: the body of the J and of the B.
    // Depth is the walk distance to the nearest transparent pixel, so this point is inside the fruit
    // by construction, and its alpha must be 255 on every size.
    static string Probes(float[] a, int w, int h)
    {
        int n = w * h;
        int[] depth = new int[n];
        int[] queue = new int[n];
        int head = 0, tail = 0;
        for (int o = 0; o < n; o++)
        {
            if (a[o] < 0.5f) { depth[o] = 0; queue[tail++] = o; }
            else depth[o] = -1;
        }
        while (head < tail)
        {
            int p = queue[head++];
            int px = p % w, py = p / w;
            int nd = depth[p] + 1;
            if (px > 0 && depth[p - 1] == -1) { depth[p - 1] = nd; queue[tail++] = p - 1; }
            if (px < w - 1 && depth[p + 1] == -1) { depth[p + 1] = nd; queue[tail++] = p + 1; }
            if (py > 0 && depth[p - w] == -1) { depth[p - w] = nd; queue[tail++] = p - w; }
            if (py < h - 1 && depth[p + w] == -1) { depth[p + w] = nd; queue[tail++] = p + w; }
        }

        byte[] seen = new byte[n];
        int[] stack = new int[n];
        int size1 = 0, x1 = 0, y1 = 0, d1 = -1, a1 = -1;
        int size2 = 0, x2 = 0, y2 = 0, d2 = -1, a2 = -1;
        for (int start = 0; start < n; start++)
        {
            if (seen[start] != 0 || a[start] < 0.5f) continue;
            int top = 0; stack[top++] = start; seen[start] = 1;
            int count = 0, mx = 0, my = 0, md = -1, ma = -1;
            while (top > 0)
            {
                int p = stack[--top]; count++;
                if (depth[p] > md) { md = depth[p]; mx = p % w; my = p / w; ma = ToByte(a[p]); }
                int px = p % w, py = p / w;
                if (px > 0) { int q = p - 1; if (seen[q] == 0 && a[q] >= 0.5f) { seen[q] = 1; stack[top++] = q; } }
                if (px < w - 1) { int q = p + 1; if (seen[q] == 0 && a[q] >= 0.5f) { seen[q] = 1; stack[top++] = q; } }
                if (py > 0) { int q = p - w; if (seen[q] == 0 && a[q] >= 0.5f) { seen[q] = 1; stack[top++] = q; } }
                if (py < h - 1) { int q = p + w; if (seen[q] == 0 && a[q] >= 0.5f) { seen[q] = 1; stack[top++] = q; } }
            }
            if (count > size1)
            {
                size2 = size1; x2 = x1; y2 = y1; d2 = d1; a2 = a1;
                size1 = count; x1 = mx; y1 = my; d1 = md; a1 = ma;
            }
            else if (count > size2) { size2 = count; x2 = mx; y2 = my; d2 = md; a2 = ma; }
        }
        StringBuilder sb = new StringBuilder();
        sb.Append("[{\"x\":").Append(x1).Append(",\"y\":").Append(y1).Append(",\"size\":").Append(size1)
          .Append(",\"depth\":").Append(d1).Append(",\"alpha\":").Append(a1).Append("}");
        if (size2 > 0)
            sb.Append(",{\"x\":").Append(x2).Append(",\"y\":").Append(y2).Append(",\"size\":").Append(size2)
              .Append(",\"depth\":").Append(d2).Append(",\"alpha\":").Append(a2).Append("}");
        sb.Append("]");
        return sb.ToString();
    }
    static string Hex()
    {
        return string.Format(CultureInfo.InvariantCulture, "#{0:X2}{1:X2}{2:X2}", FieldR, FieldG, FieldB);
    }

    static string Report(string outDir, int[] box, int cropX, int cropY, int side, int margin, int fieldPixels, int specksRemoved)
    {
        CultureInfo inv = CultureInfo.InvariantCulture;
        StringBuilder sb = new StringBuilder();
        sb.Append("{\"source\":{\"width\":").Append(W).Append(",\"height\":").Append(H).Append("},");
        sb.Append("\"field\":{\"hex\":\"").Append(Hex()).Append("\",\"r\":").Append(FieldR)
          .Append(",\"g\":").Append(FieldG).Append(",\"b\":").Append(FieldB)
          .Append(",\"sigma\":").Append(Sigma.ToString("0.##", inv))
          .Append(",\"lowCut\":").Append(LowCut.ToString("0.##", inv))
          .Append(",\"highCut\":").Append(HighCut.ToString("0.##", inv)).Append("},");
        sb.Append("\"mask\":{\"fieldPixels\":").Append(fieldPixels)
          .Append(",\"specksRemoved\":").Append(specksRemoved)
          .Append(",\"alphaBox\":{\"x\":").Append(box[0]).Append(",\"y\":").Append(box[1])
          .Append(",\"width\":").Append(box[2] - box[0] + 1).Append(",\"height\":").Append(box[3] - box[1] + 1).Append("}")
          .Append(",\"crop\":{\"x\":").Append(cropX).Append(",\"y\":").Append(cropY)
          .Append(",\"side\":").Append(side).Append(",\"margin\":").Append(margin).Append("}},");

        string[] names = new string[] {
            "jb-mark-1024.png", "jb-mark-512.png",
            "jb-mark-header-1x.png", "jb-mark-header-2x.png", "jb-mark-header-3x.png",
            "jb-mark-nav-1x.png", "jb-mark-nav-2x.png", "jb-mark-nav-3x.png",
            "jb-splash-512.png", "jb-icon-foreground-1024.png", "jb-icon-monochrome-1024.png",
            "jb-icon-background-1024.png", "jb-icon-1024.png"
        };
        sb.Append("\"files\":[");
        bool first = true;
        foreach (string name in names)
        {
            int w, h;
            float[] alpha = ReadAlpha(Path.Combine(outDir, name), out w, out h);
            float transparent; int ramp, specks; float haze;
            AlphaStats(alpha, w, h, 20, out transparent, out ramp, out haze, out specks);
            if (!first) sb.Append(",");
            first = false;
            sb.Append("{\"file\":\"").Append(name).Append("\",\"width\":").Append(w).Append(",\"height\":").Append(h);
            sb.Append(",\"cornerAlpha\":[").Append(ToByte(alpha[0])).Append(",").Append(ToByte(alpha[w - 1]))
              .Append(",").Append(ToByte(alpha[(h - 1) * w])).Append(",").Append(ToByte(alpha[h * w - 1])).Append("]");
            sb.Append(",\"transparentFraction\":").Append(transparent.ToString("0.####", inv));
            sb.Append(",\"edgeRampPx\":").Append(ramp)
              .Append(",\"hazeFraction\":").Append(haze.ToString("0.#####", inv))
              .Append(",\"specks\":").Append(specks);
            sb.Append(",\"probes\":").Append(name == "jb-mark-1024.png" ? Probes(alpha, w, h) : "[]");
            sb.Append("}");
        }
        sb.Append("]}");
        return sb.ToString();
    }
}
'@

Add-Type -TypeDefinition $csharp -Language CSharp -ReferencedAssemblies 'System.Drawing'

$json = [JBMark]::Run($Source, $OutDir, $MinSpeck, $MarginPercent)
Write-Output $json

