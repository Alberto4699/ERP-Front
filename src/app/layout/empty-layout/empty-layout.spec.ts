import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmptyLayout } from './empty-layout';

describe('EmptyLayout', () => {
  let component: EmptyLayout;
  let fixture: ComponentFixture<EmptyLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyLayout],
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyLayout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
