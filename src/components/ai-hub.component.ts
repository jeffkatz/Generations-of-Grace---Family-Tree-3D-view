
import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiService } from '../services/ai.service';

@Component({
  selector: 'app-ai-hub',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed top-28 right-6 w-96 max-h-[calc(100vh-140px)] bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col">
      <!-- Tabs -->
      <div class="flex border-b border-white/5 bg-black/20">
        @for (tab of tabs; track tab.id) {
          <button 
            (click)="activeTab.set(tab.id)"
            [class.text-white]="activeTab() === tab.id"
            [class.border-b-2]="activeTab() === tab.id"
            class="flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-indigo-500 hover:text-white"
            [class.text-slate-500]="activeTab() !== tab.id"
          >
            {{ tab.label }}
          </button>
        }
      </div>

      <!-- Content Area -->
      <div class="flex-1 overflow-y-auto p-6 scroll-smooth">
        @switch (activeTab()) {
          @case ('chat') {
            <div class="space-y-4">
              @for (msg of chatHistory(); track $index) {
                <div [class.text-right]="msg.role === 'user'" class="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div [class.bg-indigo-600]="msg.role === 'user'" 
                       [class.bg-slate-800]="msg.role === 'model'"
                       class="inline-block p-3 rounded-2xl text-xs max-w-[85%] border border-white/5">
                    {{ msg.text }}
                  </div>
                </div>
              }
              @if (loading()) {
                <div class="flex space-x-2 p-2">
                  <div class="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
                  <div class="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce delay-100"></div>
                  <div class="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce delay-200"></div>
                </div>
              }
            </div>
          }
          @case ('image') {
            <div class="space-y-6">
              <div class="p-8 border-2 border-dashed border-white/10 rounded-3xl text-center cursor-pointer hover:border-indigo-500/50 transition-colors bg-white/5 group">
                <input type="file" (change)="onFileSelected($event, 'image')" class="hidden" #imgInput>
                <div (click)="imgInput.click()" class="space-y-2">
                  <svg class="h-8 w-8 text-slate-500 mx-auto group-hover:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p class="text-[10px] font-bold text-slate-500 uppercase">Upload Ancestral Portrait</p>
                </div>
              </div>
              @if (previewUrl()) {
                <img [src]="previewUrl()" class="w-full h-48 object-cover rounded-2xl border border-white/10">
              }
            </div>
          }
          @case ('video') {
            <div class="space-y-6">
              <div class="p-8 border-2 border-dashed border-white/10 rounded-3xl text-center cursor-pointer hover:border-emerald-500/50 transition-colors bg-white/5 group">
                <input type="file" (change)="onFileSelected($event, 'video')" class="hidden" #vidInput>
                <div (click)="vidInput.click()" class="space-y-2">
                  <svg class="h-8 w-8 text-slate-500 mx-auto group-hover:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p class="text-[10px] font-bold text-slate-500 uppercase">Animate with Veo</p>
                </div>
              </div>
              @if (generatedVideoUrl()) {
                <video [src]="generatedVideoUrl()" controls class="w-full rounded-2xl border border-white/10"></video>
              }
            </div>
          }
        }
      </div>

      <!-- Input Footer -->
      <div class="p-4 bg-black/40 border-t border-white/10">
        <div class="relative">
          <input 
            [(ngModel)]="userInput"
            (keyup.enter)="handleSend()"
            placeholder="Type command..."
            class="w-full bg-slate-800/50 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          >
          <button (click)="handleSend()" class="absolute right-2 top-1.5 p-1.5 text-indigo-400 hover:text-white transition-colors">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiHubComponent {
  private aiService = inject(AiService);
  
  tabs = [
    { id: 'chat', label: 'Chat' },
    { id: 'image', label: 'Edit' },
    { id: 'video', label: 'Animate' }
  ];
  
  activeTab = signal('chat');
  userInput = '';
  loading = signal(false);
  chatHistory = signal<{role: string, text: string}[]>([]);
  previewUrl = signal<string | null>(null);
  selectedBase64 = signal<string | null>(null);
  generatedVideoUrl = signal<string | null>(null);

  async handleSend() {
    if (!this.userInput.trim() || this.loading()) return;
    
    const msg = this.userInput;
    this.userInput = '';
    const tab = this.activeTab();
    
    if (tab === 'chat') {
      this.chatHistory.update(h => [...h, { role: 'user', text: msg }]);
      this.loading.set(true);
      try {
        const reply = await this.aiService.chat([], msg);
        this.chatHistory.update(h => [...h, { role: 'model', text: reply }]);
      } catch (e) {
        this.chatHistory.update(h => [...h, { role: 'model', text: 'Error connecting to ancestors.' }]);
      } finally {
        this.loading.set(false);
      }
    } else if (tab === 'image' && this.selectedBase64()) {
       this.loading.set(true);
       const result = await this.aiService.editImage(this.selectedBase64()!, msg);
       this.chatHistory.update(h => [...h, { role: 'model', text: result }]);
       this.loading.set(false);
    } else if (tab === 'video' && this.selectedBase64()) {
       this.loading.set(true);
       const videoUrl = await this.aiService.generateVideo(this.selectedBase64()!, msg);
       this.generatedVideoUrl.set(videoUrl);
       this.loading.set(false);
    }
  }

  onFileSelected(event: any, type: string) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const base64 = e.target.result.split(',')[1];
        this.selectedBase64.set(base64);
        this.previewUrl.set(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  }
}
