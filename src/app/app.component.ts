import { Component, viewChild } from '@angular/core';
import { NgtCanvas, NgtCanvasContent } from 'angular-three/dom';
import { FluidScene } from './components/fluid-gradient.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgtCanvas, NgtCanvasContent, FluidScene], 
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {}