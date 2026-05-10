'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Split, ArrowRight, FileSpreadsheet, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DisaggregationDialog } from './disaggregation-dialog';

export function DisaggregationSection() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Feature description card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card
          className="overflow-hidden border-0"
          style={{
            background: 'linear-gradient(160deg, rgba(6,182,212,0.08) 0%, rgba(6,182,212,0.02) 100%)',
            boxShadow: '0 4px 24px rgba(6,182,212,0.08)',
          }}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
                      boxShadow: '0 4px 12px rgba(6,182,212,0.3)',
                    }}
                  >
                    <Split className="h-5 w-5 text-white" />
                  </div>
                  Disagregasi Data Agregat
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm max-w-xl">
                  Distribusikan data produksi agregat (dari BPS/dinas) ke data individual
                  pembudidaya berdasarkan proporsi historis. Sistem akan mencari pembudidaya
                  yang sesuai kriteria dan mengalokasikan secara proporsional.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Feature highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 mb-4">
              {[
                {
                  icon: Split,
                  title: 'Distribusi Proporsional',
                  desc: 'Alokasi otomatis berdasarkan riwayat produksi',
                },
                {
                  icon: FileSpreadsheet,
                  title: 'Adjustment Manual',
                  desc: 'Sesuaikan alokasi per pembudidaya',
                },
                {
                  icon: Clock,
                  title: 'Triwulan & Tahun',
                  desc: 'Dukung data per triwulan dan tahun',
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 p-3 rounded-lg"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <item.icon
                    className="h-4 w-4 shrink-0 mt-0.5"
                    style={{ color: '#06B6D4' }}
                  />
                  <div>
                    <p className="text-xs font-medium">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Action button */}
            <Button
              onClick={() => setDialogOpen(true)}
              className="gap-2 w-full sm:w-auto"
              style={{
                background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
                boxShadow: '0 4px 16px rgba(6,182,212,0.3)',
              }}
            >
              <Split className="h-4 w-4" />
              Mulai Disagregasi
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Info section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cara Kerja</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                {
                  step: '1',
                  title: 'Input Data Agregat',
                  desc: 'Masukkan total produksi agregat beserta kriteria (tahun, triwulan, kecamatan, jenis ikan, wadah, jenis usaha)',
                },
                {
                  step: '2',
                  title: 'Preview & Distribusi',
                  desc: 'Sistem mencari pembudidaya yang cocok dan mengalokasikan produksi secara proporsional berdasarkan riwayat',
                },
                {
                  step: '3',
                  title: 'Sesuaikan Alokasi',
                  desc: 'Anda bisa menyesuaikan alokasi per pembudidaya, menambah pembudidaya baru, atau mereset distribusi',
                },
                {
                  step: '4',
                  title: 'Simpan ke Database',
                  desc: 'Review hasil akhir dan simpan dengan konfirmasi sandi admin',
                },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                    style={{
                      background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
                      color: 'white',
                    }}
                  >
                    {item.step}
                  </div>
                  <div>
                    <p className="text-xs font-medium">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Dialog */}
      <DisaggregationDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
