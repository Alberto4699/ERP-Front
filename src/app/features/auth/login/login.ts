import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { Auth } from '../../../core/services/auth';
import { LoginRequest } from '../../../core/models/login-request.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  public cargando: boolean;
  public mensajeError: string;
  public loginForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: Auth,
    private router: Router
  ) {
    this.cargando = false;
    this.mensajeError = '';
    this.loginForm = this.fb.nonNullable.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]],
      remember: [true]
    });
  }

  submit(): void {
    this.mensajeError = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.cargando = true;

    const datos: LoginRequest = {
      username: this.loginForm.value.username,
      password: this.loginForm.value.password
    };

    const recordar = this.loginForm.value.remember;

    this.authService.login(datos).subscribe({
      next: (respuesta) => {
        this.authService.guardarToken(respuesta.token, recordar);
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        console.error(error);

        this.mensajeError = 'Usuario o contraseña incorrectos.';
        this.cargando = false;
      }
    });
  }
}
