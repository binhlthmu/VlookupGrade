/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle, RefreshCcw, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'motion/react';

interface FileData {
  name: string;
  data: any[];
  aoa?: any[][]; // Added to store raw array of arrays for File 01
  columns: string[];
}

export default function App() {
  const [file1, setFile1] = useState<FileData | null>(null);
  const [file2, setFile2] = useState<FileData | null>(null);
  const [mergedData, setMergedData] = useState<any[][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<{ total: number; success: number; failed: number } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const file1InputRef = useRef<HTMLInputElement>(null);
  const file2InputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fileNum: 1 | 2) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
        
        if (data.length === 0) {
          setError(`File ${fileNum} không có dữ liệu.`);
          return;
        }

        const columns = Object.keys(data[0] as object);
        const fileData: FileData = { name: file.name, data, aoa, columns };

        if (fileNum === 1) setFile1(fileData);
        else setFile2(fileData);
        
        setError(null);
        setMergedData(null);
        setStats(null);
      } catch (err) {
        setError(`Lỗi khi đọc file ${fileNum}: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  const processMerge = () => {
    if (!file1 || !file2) {
      setError('Vui lòng tải lên cả hai file.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    setTimeout(() => {
      try {
        if (!file1.aoa) throw new Error('Dữ liệu File 01 không hợp lệ.');

        const sourceData = file2.data;

        const sourceMap = new Map();
        sourceData.forEach(row => {
          const id = String(row['Mã số ID'] || row['MSSV'] || '').trim();
          const score = row['Tổng khóa học'] || row['Điểm số'] || row['Điểm'];
          if (id && score !== undefined) {
            sourceMap.set(id, score);
          }
        });

        const newAoa = [...file1.aoa.map(row => [...row])];
        const headers = newAoa[0];
        
        const mssvIdx = headers.findIndex(h => String(h).trim() === 'MSSV');
        let scoreIdx = headers.findIndex(h => String(h).trim() === 'Điểm kiểm tra thường xuyên');

        if (mssvIdx === -1) {
          throw new Error('Không tìm thấy cột "MSSV" trong File 01.');
        }

        if (scoreIdx === -1) {
          scoreIdx = headers.length;
          headers.push('Điểm kiểm tra thường xuyên');
        }

        let successCount = 0;
        let failedCount = 0;
        let totalCount = 0;

        for (let i = 1; i < newAoa.length; i++) {
          // Check if row is not empty (at least has MSSV)
          const mssv = String(newAoa[i][mssvIdx] || '').trim();
          if (!mssv) continue;
          
          totalCount++;
          const score = sourceMap.get(mssv);
          if (score !== undefined) {
            successCount++;
            newAoa[i][scoreIdx] = score;
          } else {
            failedCount++;
          }
        }

        setMergedData(newAoa);
        setStats({ total: totalCount, success: successCount, failed: failedCount });
        
        if (successCount === 0) {
          setError('Không tìm thấy MSSV trùng khớp giữa hai file. Vui lòng kiểm tra lại cột MSSV (File 01) và Mã số ID (File 02).');
        }
      } catch (err) {
        setError(`Lỗi khi xử lý: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`);
      } finally {
        setIsProcessing(false);
      }
    }, 500);
  };

  const downloadResult = () => {
    if (!mergedData || !file1) return;
    const ws = XLSX.utils.aoa_to_sheet(mergedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ket_qua_doi_chieu");
    
    const originalName = file1.name.split('.').slice(0, -1).join('.');
    XLSX.writeFile(wb, `${originalName}_Ket_qua_doi_chieu.xlsx`);
  };

  const reset = () => {
    setFile1(null);
    setFile2(null);
    setMergedData(null);
    setStats(null);
    setError(null);
    setShowPreview(false);
    if (file1InputRef.current) file1InputRef.current.value = '';
    if (file2InputRef.current) file2InputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans text-[#1e293b]">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header className="text-center space-y-3">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-block p-2 bg-blue-50 rounded-2xl mb-2"
          >
            <FileSpreadsheet className="w-10 h-10 text-blue-600" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-black tracking-tight text-[#0f172a] uppercase"
          >
            CÔNG CỤ ĐỐI CHIẾU ĐIỂM SINH VIÊN
          </motion.h1>
          <p className="text-[#64748b] font-medium">
            Tự động ghép điểm từ file nguồn vào danh sách sinh viên gốc
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6">
          {/* Step 1 */}
          <Card className="border-none shadow-sm bg-white border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs">1</span>
                Tải file danh sách sinh viên (File 01)
              </CardTitle>
              <CardDescription>File gốc cần điền điểm (phải có cột MSSV)</CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                className={`flex items-center justify-between p-4 border-2 border-dashed rounded-xl transition-all cursor-pointer ${file1 ? 'border-blue-200 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
                onClick={() => file1InputRef.current?.click()}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${file1 ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{file1 ? file1.name : 'Chưa chọn file'}</p>
                    <p className="text-xs text-slate-500">{file1 ? `${file1.data.length} dòng dữ liệu` : 'Hỗ trợ .xlsx, .xls, .csv'}</p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" className="bg-white shadow-sm border border-slate-200">
                  Chọn file
                </Button>
                <Input type="file" className="hidden" ref={file1InputRef} onChange={(e) => handleFileUpload(e, 1)} accept=".xlsx, .xls, .csv" />
              </div>
            </CardContent>
          </Card>

          {/* Step 2 */}
          <Card className="border-none shadow-sm bg-white border-l-4 border-l-emerald-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs">2</span>
                Tải file điểm (File 02)
              </CardTitle>
              <CardDescription>File chứa điểm số (phải có cột Mã số ID và Tổng khóa học)</CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                className={`flex items-center justify-between p-4 border-2 border-dashed rounded-xl transition-all cursor-pointer ${file2 ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'}`}
                onClick={() => file2InputRef.current?.click()}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${file2 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{file2 ? file2.name : 'Chưa chọn file'}</p>
                    <p className="text-xs text-slate-500">{file2 ? `${file2.data.length} dòng dữ liệu` : 'Hỗ trợ .xlsx, .xls, .csv'}</p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" className="bg-white shadow-sm border border-slate-200">
                  Chọn file
                </Button>
                <Input type="file" className="hidden" ref={file2InputRef} onChange={(e) => handleFileUpload(e, 2)} accept=".xlsx, .xls, .csv" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Process Button */}
        <div className="flex justify-center pt-4">
          <Button 
            size="lg" 
            className="px-10 py-7 text-lg font-bold rounded-2xl shadow-xl bg-slate-900 hover:bg-slate-800 transition-all uppercase tracking-wider"
            disabled={!file1 || !file2 || isProcessing}
            onClick={processMerge}
          >
            {isProcessing ? (
              <>
                <RefreshCcw className="w-5 h-5 mr-3 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              <>
                XỬ LÝ DỮ LIỆU
                <ArrowRight className="w-5 h-5 ml-3" />
              </>
            )}
          </Button>
        </div>

        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Alert variant="destructive" className="border-none shadow-lg bg-red-50 text-red-800">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <AlertTitle className="font-bold">Lỗi hệ thống</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Section */}
        <AnimatePresence>
          {stats && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <Card className="border-none shadow-xl bg-white overflow-hidden">
                <CardHeader className="bg-slate-50 border-b border-slate-100">
                  <CardTitle className="text-xl font-black uppercase tracking-tight">KẾT QUẢ:</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                      <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Tổng số sinh viên</p>
                        <p className="text-2xl font-black text-slate-900">{stats.total}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-2xl">
                      <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-600 uppercase">Ghép thành công</p>
                        <p className="text-2xl font-black text-emerald-900">{stats.success}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-2xl">
                      <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-amber-600 uppercase">Không tìm thấy điểm</p>
                        <p className="text-2xl font-black text-amber-900">{stats.failed}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col md:flex-row gap-4 justify-center">
                    <Button 
                      variant="outline" 
                      className="rounded-xl font-bold px-8 border-slate-200"
                      onClick={() => setShowPreview(!showPreview)}
                    >
                      {showPreview ? 'Ẩn bản xem trước' : 'Xem trước dữ liệu'}
                    </Button>
                    <Button 
                      className="rounded-xl font-bold px-8 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
                      onClick={downloadResult}
                    >
                      <Download className="w-5 h-5 mr-2" />
                      TẢI FILE KẾT QUẢ
                    </Button>
                    <Button variant="ghost" className="rounded-xl font-bold text-slate-400" onClick={reset}>
                      Làm lại
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {showPreview && mergedData && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <Card className="border-none shadow-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-[400px]">
                      <Table>
                        <TableHeader className="bg-slate-50 sticky top-0 z-10">
                          <TableRow>
                            {mergedData[0].slice(0, 8).map((col: any, idx: number) => (
                              <TableHead key={idx} className="font-bold text-slate-900 whitespace-nowrap">
                                {col}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mergedData.slice(1, 11).map((row, idx) => (
                            <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                              {row.slice(0, 8).map((val: any, i: number) => (
                                <TableCell key={i} className={`whitespace-nowrap ${i === mergedData[0].indexOf('Điểm kiểm tra thường xuyên') ? 'font-bold text-blue-600 bg-blue-50/30' : ''}`}>
                                  {val}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="p-3 bg-slate-50 text-center text-xs font-bold text-slate-400 uppercase border-t border-slate-100">
                      Hiển thị 10 bản ghi đầu tiên • Giữ nguyên cấu trúc File 01
                    </div>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
