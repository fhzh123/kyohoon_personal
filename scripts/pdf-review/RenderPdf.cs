using System;
using System.IO;
using System.Threading.Tasks;
using Windows.Data.Pdf;
using Windows.Storage;
using Windows.Storage.Streams;

// Native Windows PDF renderer. Does not alter or print PDF text.
internal static class RenderPdf
{
    private static int Main(string[] args)
    {
        if (args.Length != 2) { Console.Error.WriteLine("Usage: RenderPdf input.pdf output-directory"); return 2; }
        try { Run(args[0], args[1]).GetAwaiter().GetResult(); return 0; }
        catch (Exception error) { Console.Error.WriteLine(error.GetType().Name + ": " + error.Message); return 1; }
    }
    private static async Task Run(string source, string output)
    {
        Directory.CreateDirectory(output);
        StorageFile input = await StorageFile.GetFileFromPathAsync(Path.GetFullPath(source));
        PdfDocument pdf = await PdfDocument.LoadFromFileAsync(input);
        Console.WriteLine("Pages: " + pdf.PageCount);
        for (uint index = 0; index < pdf.PageCount; index++)
        {
            using (PdfPage page = pdf.GetPage(index))
            using (InMemoryRandomAccessStream rendered = new InMemoryRandomAccessStream())
            {
                PdfPageRenderOptions options = new PdfPageRenderOptions();
                options.DestinationWidth = 1400;
                await page.RenderToStreamAsync(rendered, options);
                rendered.Seek(0);
                byte[] data = new byte[checked((int)rendered.Size)];
                using (DataReader reader = new DataReader(rendered))
                {
                    await reader.LoadAsync((uint)data.Length);
                    reader.ReadBytes(data);
                }
                string destination = Path.Combine(output, "page-" + (index + 1).ToString("D2") + ".png");
                File.WriteAllBytes(destination, data);
                Console.WriteLine(Path.GetFileName(destination));
            }
        }
    }
}
