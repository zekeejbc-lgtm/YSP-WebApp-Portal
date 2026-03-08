type JsPdfConstructor = typeof import("jspdf").default;
type AutoTableFn = typeof import("jspdf-autotable").default;
type ExcelJSImport = typeof import("exceljs").default;

let pdfToolsPromise: Promise<{ JsPDF: JsPdfConstructor; autoTable: AutoTableFn }> | null = null;
let excelJsPromise: Promise<ExcelJSImport> | null = null;

export function loadPdfTools(): Promise<{ JsPDF: JsPdfConstructor; autoTable: AutoTableFn }> {
  if (!pdfToolsPromise) {
    pdfToolsPromise = Promise.all([import("jspdf"), import("jspdf-autotable")]).then(
      ([jspdfModule, autoTableModule]) => ({
        JsPDF: jspdfModule.default,
        autoTable: autoTableModule.default,
      })
    );
  }

  return pdfToolsPromise;
}

export function loadExcelJS(): Promise<ExcelJSImport> {
  if (!excelJsPromise) {
    excelJsPromise = import("exceljs").then((module) => module.default);
  }

  return excelJsPromise;
}
