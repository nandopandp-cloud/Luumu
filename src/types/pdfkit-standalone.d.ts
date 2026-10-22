// O build standalone do pdfkit (que embute as métricas de fonte) não tem tipos próprios.
// Reaproveitamos o construtor tipado do pacote principal.
declare module "pdfkit/js/pdfkit.standalone.js" {
  import PDFDocument from "pdfkit";
  export default PDFDocument;
}
