'use client';

import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';

const MapInner = dynamic(() => import('./map-inner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] sm:h-[500px] lg:h-[600px] rounded-lg border flex items-center justify-center bg-muted">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-2 border-teal-600 border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Memuat peta...</p>
      </div>
    </div>
  ),
});

export function MapView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
          <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-teal-600" />
            Peta Lokasi Budidaya
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
          <MapInner />
        </CardContent>
      </Card>
    </motion.div>
  );
}
