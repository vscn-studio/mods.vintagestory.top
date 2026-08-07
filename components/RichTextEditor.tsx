'use client';

import { Editor } from '@tinymce/tinymce-react';
import 'tinymce/tinymce';
import 'tinymce/icons/default';
import 'tinymce/models/dom';
import 'tinymce/plugins/advlist';
import 'tinymce/plugins/anchor';
import 'tinymce/plugins/autolink';
import 'tinymce/plugins/code';
import 'tinymce/plugins/codesample';
import 'tinymce/plugins/emoticons';
import 'tinymce/plugins/fullscreen';
import 'tinymce/plugins/help';
import 'tinymce/plugins/image';
import 'tinymce/plugins/insertdatetime';
import 'tinymce/plugins/link';
import 'tinymce/plugins/lists';
import 'tinymce/plugins/media';
import 'tinymce/plugins/preview';
import 'tinymce/plugins/quickbars';
import 'tinymce/plugins/searchreplace';
import 'tinymce/plugins/table';
import 'tinymce/plugins/visualblocks';
import 'tinymce/plugins/wordcount';
import 'tinymce/skins/ui/oxide/skin.min.css';
import 'tinymce/themes/silver';
import { bilibiliEmbedHtml } from '@/lib/bilibili';

export type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  height?: number;
  mode?: 'compact' | 'full';
};

export function RichTextEditor({ value, onChange, ariaLabel, height = 340, mode = 'compact' }: RichTextEditorProps) {
  const fullEditor = mode === 'full';
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
          statusbar: fullEditor,
          resize: true,
          plugins: fullEditor
            ? 'advlist anchor autolink code codesample emoticons fullscreen help image insertdatetime link lists media preview quickbars searchreplace table visualblocks wordcount'
            : 'advlist autolink code codesample fullscreen link lists searchreplace visualblocks wordcount',
          toolbar: fullEditor
            ? 'undo redo | blocks fontsize | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image media table blockquote codesample | forecolor backcolor removeformat | emoticons insertdatetime fullscreen preview code help'
            : 'undo redo | blocks | bold italic underline strikethrough | bullist numlist outdent indent | link blockquote codesample | removeformat | fullscreen code',
          toolbar_mode: 'sliding',
          quickbars_selection_toolbar: fullEditor ? 'bold italic underline | quicklink h2 h3 blockquote' : undefined,
          link_default_target: '_blank',
          link_assume_external_targets: 'https',
          image_title: true,
          media_url_resolver: fullEditor ? async (data: { url: string }) => ({ html: bilibiliEmbedHtml(data.url) ?? '' }) : undefined,
          skin: false,
          content_css: false,
          content_style: 'body { margin: 14px; color: #302f2a; background: #ffffff; font: 500 15px/1.65 system-ui, sans-serif; } a { color: #66753b; } img { max-width: 100%; height: auto; } table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #d7d4ca; padding: 8px; } iframe { display: block; width: 100%; max-width: 100%; border: 0; }'
        }}
      />
    </div>
  );
}
