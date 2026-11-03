'use client';

import { useState, type FormEvent } from 'react';
import type { CasUploadDto } from '@wealthos/shared-types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorBanner,
  Input,
  Label,
  PageHeader,
  Spinner,
  Table,
  Td,
  Th,
  type BadgeTone,
} from '@wealthos/ui-core';
import { ApiError, apiFetch } from '@/lib/api';
import { formatDate, label } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';

interface CasSummary {
  upload: CasUploadDto;
  imported: number;
  duplicatesSkipped: number;
  skippedLines: number;
}

const STATUS_TONES: Record<string, BadgeTone> = {
  SUCCESS: 'success',
  PARTIAL: 'warning',
  PROCESSING: 'info',
  FAILED: 'danger',
};

export default function CasPage() {
  const { data, error, loading, reload } = useApiData<CasUploadDto[]>('/cas/uploads');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CasSummary | null>(null);

  async function upload(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!file) {
      setFormError('Choose a CAS PDF first');
      return;
    }
    setBusy(true);
    setFormError(null);
    setSummary(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const result = await apiFetch<CasSummary>('/cas/upload', { method: 'POST', body });
      setSummary(result);
      setFile(null);
      reload();
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : 'Could not parse this CAS PDF');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="CAS import"
        description="Upload a CAMS or Karvy consolidated statement to rebuild your historical portfolio."
      />
      <ErrorBanner message={error ?? formError} />
      {summary ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Imported {summary.imported} transactions, skipped {summary.duplicatesSkipped} duplicates and {summary.skippedLines} unreadable lines.
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upload statement</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => void upload(event)} className="space-y-4">
              <div>
                <Label htmlFor="cas-file">CAS PDF</Label>
                <Input
                  id="cas-file"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
                <p className="mt-1 text-xs text-slate-500">PDF only, up to 12 MB. Re-uploads are de-duplicated.</p>
              </div>
              <Button type="submit" className="w-full" disabled={busy || file === null}>
                {busy ? 'Parsing statement...' : 'Import CAS'}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upload history</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center gap-3 p-5 text-sm text-slate-500">
                <Spinner /> Loading uploads...
              </div>
            ) : data && data.length > 0 ? (
              <Table className="border-0 shadow-none">
                <thead>
                  <tr>
                    <Th>File</Th>
                    <Th>Imported</Th>
                    <Th>Duplicates</Th>
                    <Th>Status</Th>
                    <Th>Date</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((upload) => (
                    <tr key={upload.id}>
                      <Td>
                        <p className="font-medium text-slate-900">{upload.fileName}</p>
                        <p className="text-xs text-slate-500">{upload.parserVersion}</p>
                      </Td>
                      <Td className="tabular-nums">{upload.transactionsImported}</Td>
                      <Td className="tabular-nums">{upload.duplicatesSkipped}</Td>
                      <Td>
                        <Badge tone={STATUS_TONES[upload.status] ?? 'neutral'}>{label(upload.status)}</Badge>
                      </Td>
                      <Td>{formatDate(upload.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="p-5 text-sm text-slate-500">No statements imported yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
