'use client';

import { Editor } from '@tinymce/tinymce-react';
import 'tinymce/tinymce';
import 'tinymce/icons/default';
import 'tinymce/models/dom';
import 'tinymce/plugins/autolink';
import 'tinymce/plugins/code';
import 'tinymce/plugins/link';
import 'tinymce/plugins/lists';
import 'tinymce/skins/ui/oxide/skin.min.css';
import 'tinymce/themes/silver';

export type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  height?: number;
};

export function RichTextEditor({ value, onChange, ariaLabel, height = 300 }: RichTextEditorProps) {
  return (
    <div className="management-rich-editor" aria-label={ariaLabel}>
      <Editor
        tinymceScriptSrc={[]}
        licenseKey="gpl"
        value={value}
        onEditorChange={onChange}
        init={{
          height,
          menubar: false,
          branding: false,
          promotion: false,
          statusbar: false,
          plugins: 'autolink code link lists',
          toolbar: 'undo redo | blocks | bold italic underline | bullist numlist | link code',
          toolbar_mode: 'sliding',
          skin: false,
          content_css: false,
          content_style: 'body { margin: 12px; color: #302f2a; background: #fffdf7; font: 500 14px/1.6 system-ui, sans-serif; } a { color: #66753b; }'
        }}
      />
    </div>
  );
}
