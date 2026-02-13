import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { NgtCanvas, NgtCanvasContent } from 'angular-three/dom';
import { FluidScene } from './components/fluid-gradient.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgtCanvas, NgtCanvasContent, FluidScene],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
    isDarkMode = false;

    constructor(private cdr: ChangeDetectorRef) {}

    ngOnInit() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this.isDarkMode = mediaQuery.matches;
        console.log(this.isDarkMode);
        mediaQuery.addEventListener('change', (e) => {
            this.isDarkMode = e.matches;
            console.log(this.isDarkMode);
            this.cdr.detectChanges();
        });
    }
}